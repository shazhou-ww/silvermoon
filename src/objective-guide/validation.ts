import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { types } from "node:util";
import { parseStrictYaml } from "../foundation/schema/index.ts";
import type {
  JsonValue, ObjectiveDomainSchema, ObjectiveGuideManifest, ObjectiveValidationIssues,
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
export function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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
  fields(value, ["schemaVersion", "domainSchema", "levels", "defaultLanguage", "languages"], ["prerequisite"]);
  if (value.schemaVersion !== 1 || !record(value.domainSchema) || !json(value.domainSchema)
    || !Array.isArray(value.levels) || value.levels.length === 0
    || !text(value.defaultLanguage) || !canonicalLanguage(value.defaultLanguage)
    || !Array.isArray(value.languages) || value.languages.length === 0
    || !value.languages.every((language) => text(language) && canonicalLanguage(language))
    || !value.languages.includes(value.defaultLanguage)
    || new Set(value.languages).size !== value.languages.length) {
    throw new ObjectiveConfigurationError("Invalid Manifest schema, levels or languages.");
  }
  const levels = value.levels.map((entry: unknown) => {
    if (!record(entry)) throw new ObjectiveConfigurationError("Invalid level.");
    fields(entry, ["id", "advancement"]);
    if (!identifier(entry.id) || entry.id === "terminal" || !record(entry.advancement)) {
      throw new ObjectiveConfigurationError("Levels require a non-reserved ID and advancement.");
    }
    fields(entry.advancement, ["checks"]);
    if (!Array.isArray(entry.advancement.checks) || !entry.advancement.checks.every(identifier)) {
      throw new ObjectiveConfigurationError("Advancement checks must be CheckIds.");
    }
    return { id: entry.id, advancement: { checks: entry.advancement.checks.map(String) } };
  });
  const first = levels[0]!;
  if (new Set(levels.map(({ id }) => id)).size !== levels.length) {
    throw new ObjectiveConfigurationError("Duplicate level ID.");
  }
  let prerequisite;
  if (Object.hasOwn(value, "prerequisite")) {
    if (!record(value.prerequisite)) throw new ObjectiveConfigurationError("Invalid prerequisite.");
    fields(value.prerequisite, ["manifestUri", "subject"], ["minimumLevelId"]);
    if (!text(value.prerequisite.manifestUri) || !text(value.prerequisite.subject)
      || (Object.hasOwn(value.prerequisite, "minimumLevelId")
        && value.prerequisite.minimumLevelId !== "terminal"
        && !identifier(value.prerequisite.minimumLevelId))) {
      throw new ObjectiveConfigurationError("Invalid prerequisite URI, projection or minimum level.");
    }
    prerequisite = {
      manifestUri: value.prerequisite.manifestUri,
      subject: value.prerequisite.subject,
      ...(typeof value.prerequisite.minimumLevelId === "string"
        ? { minimumLevelId: value.prerequisite.minimumLevelId } : {}),
    };
  }
  return immutable({
    schemaVersion: 1,
    domainSchema: value.domainSchema,
    levels: [first, ...levels.slice(1)],
    defaultLanguage: value.defaultLanguage,
    languages: [value.languages[0], ...value.languages.slice(1)],
    ...(prerequisite === undefined ? {} : { prerequisite }),
  });
}
export function compileDomain(schema: ObjectiveDomainSchema): ValidateFunction {
  if (schema.type !== "object" || (schema.$schema !== undefined
    && schema.$schema !== "https://json-schema.org/draft/2020-12/schema")) {
    throw new ObjectiveConfigurationError("Domain must be a Draft 2020-12 root object schema.");
  }
  function inspect(value: unknown) {
    if (Array.isArray(value)) {
      for (const child of value) inspect(child);
      return;
    }
    if (!record(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && (typeof child !== "string" || !child.startsWith("#/$defs/"))) {
        throw new ObjectiveConfigurationError("Only local #/$defs schema references are allowed.");
      }
      inspect(child);
    }
  }
  inspect(schema);
  try {
    return new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  } catch (caught) {
    throw new ObjectiveConfigurationError("Invalid Objective domain schema.", { cause: caught });
  }
}
export function validateSubject(subject: unknown, validate: ValidateFunction): ObjectiveValidationIssues | null {
  if (!record(subject) || !json(subject) || !validate(subject)) {
    const issues = (validate.errors ?? [{ instancePath: "", keyword: "type", message: "Subject must be a JSON object." }])
      .map(({ instancePath = "", keyword, message = "Validation failed." }) => ({ instancePath, keyword, message }));
    return [issues[0]!, ...issues.slice(1)];
  }
  return null;
}
