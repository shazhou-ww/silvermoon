import type { ValidateFunction } from "ajv";
import type {
  CheckResult, ObjectiveGuide, ObjectiveGuideContentManifest, ObjectiveGuideInstance,
  ObjectiveGuideInstanceCreationError, ObjectiveGuideLoadBindings, ObjectiveGuideManifest,
  ObjectiveLevelDescription, ObjectiveObservation, ObjectiveSubject, ReferencePage,
} from "./types.ts";
import { compileSubjectProjection } from "./projection.ts";
import { canonicalManifestUri } from "./resources.ts";
import {
  compileDomain, immutable, json, ObjectiveConfigurationError, ObjectiveOperationError,
  record, text, validateSubject,
} from "./validation.ts";

export interface LoadedLocale {
  content: ObjectiveGuideContentManifest;
  pages: ReadonlyMap<string, ReferencePage>;
  fallbackId: string;
}
const validators = new WeakMap<ObjectiveGuide, ValidateFunction>();

function checkResult(value: unknown, locale: LoadedLocale): CheckResult {
  if (!record(value) || typeof value.pass !== "boolean") throw new ObjectiveOperationError("Invalid check result.");
  if (value.pass) {
    if (Object.keys(value).length !== 1) throw new ObjectiveOperationError("Passing check must contain only pass.");
    return { pass: true };
  }
  if (Object.keys(value).length !== 2 || !Array.isArray(value.problems) || value.problems.length === 0) {
    throw new ObjectiveOperationError("Failed check must return nonempty problems.");
  }
  const problems = value.problems.map((entry: unknown) => {
    if (!record(entry) || Object.keys(entry).length !== 2 || !text(entry.pageId) || !text(entry.description)
      || !locale.pages.has(entry.pageId)) throw new ObjectiveOperationError("Check returned an invalid or unknown problem page.");
    return Object.freeze({ pageId: entry.pageId, description: entry.description });
  });
  return { pass: false, problems: [problems[0]!, ...problems.slice(1)] };
}

export function createObjectiveGuide(
  manifestUri: string,
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
  locales: ReadonlyMap<string, LoadedLocale>,
): ObjectiveGuide {
  const prerequisiteUri = manifest.prerequisite === undefined ? undefined
    : canonicalManifestUri(manifest.prerequisite.manifestUri, manifestUri);
  if (prerequisiteUri !== bindings.prerequisite?.manifestUri) {
    throw new ObjectiveConfigurationError("Missing, extra or mismatched prerequisite binding.");
  }
  if (!record(bindings.checks)) throw new ObjectiveConfigurationError("Checks must be an owned function map.");
  for (const level of manifest.levels) for (const name of level.advancement.checks) {
    if (!Object.hasOwn(bindings.checks, name) || typeof bindings.checks[name] !== "function") {
      throw new ObjectiveConfigurationError(`Unknown bound check: ${name}.`);
    }
  }
  const checks = Object.freeze({ ...bindings.checks });
  const prerequisite = bindings.prerequisite === undefined ? null : Object.freeze({
    guide: bindings.prerequisite,
    mapSubject: compileSubjectProjection(manifest.prerequisite!.subject),
  });
  const domain = compileDomain(manifest.domainSchema);
  const guide: ObjectiveGuide = {
    manifestUri,
    domainSchema: manifest.domainSchema,
    prerequisite,
    createInstance({ subject, language = manifest.defaultLanguage }) {
      const issues = validateSubject(subject, domain);
      if (issues !== null) return { ok: false, error: { type: "invalid-subject", guide, subject, issues } };
      const stableSubject = immutable(structuredClone(subject));
      const child = guide.prerequisite?.guide;
      let childInstance: ObjectiveGuideInstance | null = null;
      if (child !== undefined) {
        let projected: unknown;
        try {
          projected = prerequisite!.mapSubject(stableSubject);
        } catch (caught) {
          return { ok: false, error: {
            type: "invalid-prerequisite-subject", guide: child, chain: [guide, child],
            failure: { type: "projection-failed", message: caught instanceof Error ? caught.message : String(caught) },
          } };
        }
        const validate = validators.get(child) ?? compileDomain(child.domainSchema);
        const projectedIssues = validateSubject(projected, validate);
        if (projectedIssues !== null || !record(projected) || !json(projected)) {
          return { ok: false, error: {
            type: "invalid-prerequisite-subject", guide: child, chain: [guide, child],
            failure: { type: "validation-failed", projectedSubject: projected,
              issues: projectedIssues ?? [{ instancePath: "", keyword: "type", message: "Projection must be a JSON object." }] },
          } };
        }
        const created = child.createInstance({ subject: projected, language });
        if (!created.ok) {
          const error = created.error;
          let mapped: ObjectiveGuideInstanceCreationError;
          if (error.type === "invalid-subject") {
            mapped = { type: "invalid-prerequisite-subject", guide: child, chain: [guide, child],
              failure: { type: "validation-failed", projectedSubject: projected, issues: error.issues } };
          } else if (error.type === "invalid-prerequisite-subject") {
            mapped = { ...error, chain: [guide, error.chain[0], ...error.chain.slice(1)] };
          } else {
            if (!locales.has(language)) return { ok: false, error: {
              type: "unsupported-language", guide, chain: [guide], language, supportedLanguages: [...locales.keys()],
            } };
            mapped = { ...error, chain: [guide, ...error.chain] };
          }
          return { ok: false, error: mapped };
        }
        childInstance = created.instance;
      }
      const locale = locales.get(language);
      if (locale === undefined) return { ok: false, error: {
        type: "unsupported-language", guide, chain: [guide], language, supportedLanguages: [...locales.keys()],
      } };
      let descriptions: readonly ObjectiveLevelDescription[];
      const instance: ObjectiveGuideInstance = {
        guide, subject: stableSubject, language,
        title: locale.content.title, description: locale.content.description,
        prerequisite: childInstance,
        describeLevels: () => descriptions,
        async probe(): Promise<ObjectiveObservation> {
          if (childInstance !== null) {
            const observation = await childInstance.probe();
            if (observation.current.id !== "terminal") return observation;
          }
          for (const level of manifest.levels) {
            for (const name of level.advancement.checks) {
              const result = checkResult(await checks[name]!(stableSubject, language), locale);
              if (!result.pass) {
                const current = descriptions.find((entry) => entry.instance === instance && entry.id === level.id)!;
                return Object.freeze({ current, problems: Object.freeze([...result.problems]),
                  gapSummary: result.problems.map(({ description }) => description).join("\n") });
              }
            }
          }
          return Object.freeze({ current: descriptions.at(-1)!, problems: Object.freeze([]), gapSummary: "" });
        },
        async readPage(pageId) {
          if (!text(pageId)) throw new ObjectiveOperationError("Page ID must be nonempty.");
          return locale.pages.get(pageId) ?? locale.pages.get(locale.fallbackId)!;
        },
        async searchPages(query) {
          if (typeof query !== "string") throw new ObjectiveOperationError("Search query must be a string.");
          const needle = query.trim().toLocaleLowerCase(language);
          return Object.freeze([...locale.pages.values()]
            .filter(({ title, content }) => `${title}\n${content}`.toLocaleLowerCase(language).includes(needle))
            .map(({ id, title }) => Object.freeze({ id, title })));
        },
      };
      descriptions = Object.freeze([
        ...(childInstance?.describeLevels().filter(({ id }) => id !== "terminal") ?? []),
        ...manifest.levels.map(({ id }) => {
          const content = locale.content.levels[id]!;
          return Object.freeze({ instance, id, title: content.title,
            description: content.description, advancementOutcome: content.outcome });
        }),
        Object.freeze({ instance, id: "terminal", ...locale.content.terminal, advancementOutcome: null }),
      ]);
      return { ok: true, instance: Object.freeze(instance) };
    },
  };
  validators.set(guide, domain);
  return Object.freeze(guide);
}
