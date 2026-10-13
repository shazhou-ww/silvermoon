import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { types } from "node:util";
import { parseStrictYaml } from "../foundation/schema/index.ts";
import type {
  JsonValue, ObjectiveDomainSchema, ObjectiveGuideContentManifest,
  ObjectiveGuideManifest, ObjectiveValidationIssues,
} from "./types.ts";

export class ObjectiveConfigurationError extends TypeError {}
export class ObjectiveOperationError extends TypeError {}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && !types.isProxy(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function json(value: unknown, ancestors = new Set<unknown>()): value is JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (types.isProxy(value)) return false;
  if ((!Array.isArray(value) && !record(value)) || ancestors.has(value)) return false;
  if (Array.isArray(value) && (Object.getPrototypeOf(value) !== Array.prototype
    || Object.keys(value).length !== value.length
    || Object.keys(value).some((key, index) => key !== String(index)))) return false;
  if (Object.getOwnPropertySymbols(value).length > 0
    || Object.entries(Object.getOwnPropertyDescriptors(value)).some(([name, descriptor]) =>
      descriptor.get !== undefined || descriptor.set !== undefined
      || (!descriptor.enumerable && !(Array.isArray(value) && name === "length")))) return false;
  ancestors.add(value);
  const result = Object.values(value).every((child) => json(child, ancestors));
  ancestors.delete(value);
  return result;
}
export function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some((key) => !Object.hasOwn(value, key))
    || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new ObjectiveConfigurationError(`Expected fields: ${[...required, ...optional].join(", ")}.`);
  }
}
function canonicalLanguage(language: string) {
  try {
    return Intl.getCanonicalLocales(language)[0] === language;
  } catch (caught) {
    if (!(caught instanceof RangeError)) throw caught;
    return false;
  }
}
export function parseManifest(source: string): ObjectiveGuideManifest {
  const value: unknown = parseStrictYaml(source);
  if (!record(value)) throw new ObjectiveConfigurationError("Objective Manifest must be an object.");
  fields(value, ["schemaVersion", "domainSchema", "levels", "defaultLanguage", "localizations"], ["prerequisite"]);
  if (value.schemaVersion !== 1 || !record(value.domainSchema) || !json(value.domainSchema)
    || !Array.isArray(value.levels) || value.levels.length === 0
    || !text(value.defaultLanguage) || !canonicalLanguage(value.defaultLanguage)
    || !record(value.localizations) || !Object.hasOwn(value.localizations, value.defaultLanguage)) {
    throw new ObjectiveConfigurationError("Invalid Manifest schema, levels or default language.");
  }
  const levels = value.levels.map((entry: unknown) => {
    if (!record(entry)) throw new ObjectiveConfigurationError("Invalid level.");
    fields(entry, ["id", "advancement"]);
    if (!text(entry.id) || entry.id === "terminal" || !record(entry.advancement)) {
      throw new ObjectiveConfigurationError("Levels require a non-reserved ID and advancement.");
    }
    fields(entry.advancement, ["checks"]);
    if (!Array.isArray(entry.advancement.checks) || !entry.advancement.checks.every(text)) {
      throw new ObjectiveConfigurationError("Advancement checks must be CheckIds.");
    }
    return { id: entry.id, advancement: { checks: entry.advancement.checks.map(String) } };
  });
  const first = levels[0]!;
  if (new Set(levels.map(({ id }) => id)).size !== levels.length) {
    throw new ObjectiveConfigurationError("Duplicate level ID.");
  }
  const localizations = Object.fromEntries(Object.entries(value.localizations).map(([language, locale]) => {
    if (!canonicalLanguage(language) || !record(locale)) throw new ObjectiveConfigurationError("Invalid locale.");
    fields(locale, ["content", "references"]);
    if (!text(locale.content) || !record(locale.references)) throw new ObjectiveConfigurationError("Invalid locale resources.");
    fields(locale.references, ["source"], ["notFoundPageId"]);
    if (!text(locale.references.source)
      || (Object.hasOwn(locale.references, "notFoundPageId") && !text(locale.references.notFoundPageId))) {
      throw new ObjectiveConfigurationError("Invalid References source or not-found ID.");
    }
    return [language, {
      content: locale.content,
      references: {
        source: locale.references.source,
        ...(typeof locale.references.notFoundPageId === "string" ? { notFoundPageId: locale.references.notFoundPageId } : {}),
      },
    }];
  }));
  let prerequisite;
  if (Object.hasOwn(value, "prerequisite")) {
    if (!record(value.prerequisite)) throw new ObjectiveConfigurationError("Invalid prerequisite.");
    fields(value.prerequisite, ["manifestUri", "subject"]);
    if (!text(value.prerequisite.manifestUri) || !text(value.prerequisite.subject)) {
      throw new ObjectiveConfigurationError("Invalid prerequisite URI or projection.");
    }
    prerequisite = { manifestUri: value.prerequisite.manifestUri, subject: value.prerequisite.subject };
  }
  return immutable({
    schemaVersion: 1,
    domainSchema: value.domainSchema,
    levels: [first, ...levels.slice(1)],
    defaultLanguage: value.defaultLanguage,
    localizations,
    ...(prerequisite === undefined ? {} : { prerequisite }),
  });
}
export function parseContent(source: string, levelIds: readonly string[]): ObjectiveGuideContentManifest {
  const value: unknown = parseStrictYaml(source);
  if (!record(value)) throw new ObjectiveConfigurationError("Locale content must be an object.");
  fields(value, ["title", "description", "terminal", "levels"]);
  if (!text(value.title) || !text(value.description) || !record(value.terminal) || !record(value.levels)) {
    throw new ObjectiveConfigurationError("Incomplete locale content.");
  }
  fields(value.terminal, ["title", "description"]);
  const levelContent = value.levels;
  if (!text(value.terminal.title) || !text(value.terminal.description)
    || Object.keys(levelContent).length !== levelIds.length
    || levelIds.some((id) => !Object.hasOwn(levelContent, id))) {
    throw new ObjectiveConfigurationError("Locale must cover exactly the Manifest levels and terminal.");
  }
  const levels = Object.fromEntries(Object.entries(value.levels).map(([id, entry]) => {
    if (!record(entry)) throw new ObjectiveConfigurationError(`Invalid level content: ${id}.`);
    fields(entry, ["title", "description", "outcome"]);
    if (!text(entry.title) || !text(entry.description) || !text(entry.outcome)) {
      throw new ObjectiveConfigurationError(`Incomplete level content: ${id}.`);
    }
    return [id, { title: entry.title, description: entry.description, outcome: entry.outcome }];
  }));
  return immutable({ title: value.title, description: value.description,
    terminal: { title: value.terminal.title, description: value.terminal.description }, levels });
}
export function compileDomain(schema: ObjectiveDomainSchema): ValidateFunction {
  if (schema.type !== "object" || (schema.$schema !== undefined
    && schema.$schema !== "https://json-schema.org/draft/2020-12/schema")) {
    throw new ObjectiveConfigurationError("Domain must be a Draft 2020-12 root object schema.");
  }
  function inspect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (!record(value)) return;
    if ((value.$ref !== undefined && (typeof value.$ref !== "string" || !value.$ref.startsWith("#/$defs/")))
      || value.$id !== undefined || value.$dynamicRef !== undefined || value.$recursiveRef !== undefined) {
      throw new ObjectiveConfigurationError("Only local #/$defs references are allowed.");
    }
    for (const key of ["$defs", "properties", "patternProperties", "dependentSchemas"]) {
      const children = value[key];
      if (record(children)) Object.values(children).forEach(inspect);
    }
    for (const key of ["additionalProperties", "unevaluatedProperties", "propertyNames",
      "contains", "items", "unevaluatedItems", "not", "if", "then", "else"]) inspect(value[key]);
    for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
      const children = value[key];
      if (Array.isArray(children)) children.forEach(inspect);
    }
  }
  inspect(schema);
  const ajv = new Ajv2020({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false });
  try {
    return ajv.compile(schema);
  } catch (caught) {
    if (!(caught instanceof Error)) throw caught;
    throw new ObjectiveConfigurationError(`Invalid subject schema: ${caught.message}`, { cause: caught });
  }
}
export function validateSubject(value: unknown, validate: ValidateFunction): ObjectiveValidationIssues | null {
  if (!record(value) || !json(value)) {
    return [{ instancePath: "", keyword: "type", message: "Subject must be an ordinary JSON object." }];
  }
  if (validate(value)) return null;
  const issues = (validate.errors ?? []).map(({ instancePath, keyword, message }) => ({
    instancePath, keyword, message: message ?? `Failed ${keyword}.`,
  }));
  const first = issues[0];
  if (first === undefined) throw new ObjectiveOperationError("Schema validator failed without diagnostics.");
  return [first, ...issues.slice(1)];
}
