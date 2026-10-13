import type { ValidateFunction } from "ajv";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CheckRequest, CheckResult, ObjectiveCheckRunner, ObjectiveGuide, ObjectiveGuideInstance,
  ObjectiveGuideInstanceCreationError, ObjectiveGuideManifest, ObjectiveLevelDescription,
  ObjectiveObservation, ObjectiveSubject, ReferencePage,
} from "./types.ts";
import { compileSubjectProjection } from "./projection.ts";
import { canonicalManifestUri } from "./resources.ts";
import type { LoadedLocale } from "./resources.ts";
import {
  compileDomain, identifier, immutable, json, ObjectiveConfigurationError,
  ObjectiveOperationError, record, text, validateSubject,
} from "./validation.ts";

interface ProbeContext {
  tempDirectory: string;
}
const validators = new WeakMap<ObjectiveGuide, ValidateFunction>();
const guideLevels = new WeakMap<ObjectiveGuide, readonly string[]>();
const probeWithContext = new WeakMap<
ObjectiveGuideInstance,
(context: ProbeContext) => Promise<ObjectiveObservation>
>();

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
    if (!record(entry) || Object.keys(entry).length !== 2 || !identifier(entry.id)
      || !record(entry.parameters) || !json(entry.parameters)
      || !locale.pages.has(`problems/${entry.id}`)) {
      throw new ObjectiveOperationError("Check returned an invalid or unknown Problem ID.");
    }
    return Object.freeze({ id: entry.id, parameters: immutable(structuredClone(entry.parameters)) });
  });
  return { pass: false, problems: [problems[0]!, ...problems.slice(1)] };
}

function problemSummary(locale: LoadedLocale, problem: { id: string; parameters: Readonly<Record<string, unknown>> }) {
  const page = locale.pages.get(`problems/${problem.id}`)!;
  const detail = problem.parameters.description;
  return typeof detail === "string" && detail.trim() !== "" ? detail : page.description ?? page.title;
}

export function createObjectiveGuide(
  manifestUri: string,
  manifest: ObjectiveGuideManifest,
  prerequisiteGuide: ObjectiveGuide | undefined,
  runner: ObjectiveCheckRunner,
  locales: ReadonlyMap<string, LoadedLocale>,
): ObjectiveGuide {
  const prerequisiteUri = manifest.prerequisite === undefined ? undefined
    : canonicalManifestUri(manifest.prerequisite.manifestUri, manifestUri);
  if (prerequisiteUri !== prerequisiteGuide?.manifestUri) {
    throw new ObjectiveConfigurationError("Missing, extra or mismatched prerequisite Guide.");
  }
  const minimumLevelId = manifest.prerequisite?.minimumLevelId ?? "terminal";
  if (prerequisiteGuide !== undefined && minimumLevelId !== "terminal"
    && !guideLevels.get(prerequisiteGuide)?.includes(minimumLevelId)) {
    throw new ObjectiveConfigurationError(`Unknown prerequisite minimum level: ${minimumLevelId}.`);
  }
  const prerequisite = prerequisiteGuide === undefined ? null : Object.freeze({
    guide: prerequisiteGuide,
    minimumLevelId,
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
      const overview = locale.pages.get("system/overview")!;
      let descriptions: readonly ObjectiveLevelDescription[];
      const instance: ObjectiveGuideInstance = {
        guide, subject: stableSubject, language,
        title: overview.title, description: overview.description!,
        prerequisite: childInstance,
        describeLevels: () => descriptions,
        async probe(): Promise<ObjectiveObservation> {
          const tempDirectory = await mkdtemp(join(tmpdir(), "silvermoon-probe-"));
          try {
            return await probeWithContext.get(instance)!({ tempDirectory });
          } finally {
            await rm(tempDirectory, { recursive: true, force: true });
          }
        },
        async readPage(pageId) {
          if (!text(pageId)) throw new ObjectiveOperationError("Page ID must be nonempty.");
          return locale.pages.get(pageId) ?? locale.pages.get("system/404")!;
        },
        async searchPages(query) {
          if (typeof query !== "string") throw new ObjectiveOperationError("Search query must be a string.");
          const needle = query.trim().toLocaleLowerCase(language);
          return Object.freeze([...locale.pages.values()]
            .filter(({ title, description = "", content }) =>
              `${title}\n${description}\n${content}`.toLocaleLowerCase(language).includes(needle))
            .map(({ id, title }) => Object.freeze({ id, title })));
        },
      };
      const childDescriptions = childInstance?.describeLevels() ?? [];
      const prefix = childInstance === null ? [] : minimumLevelId === "terminal"
        ? childDescriptions.filter(({ id }) => id !== "terminal")
        : childDescriptions.slice(0, childDescriptions.findIndex(
          ({ instance: owner, id }) => owner === childInstance && id === minimumLevelId,
        ));
      descriptions = Object.freeze([
        ...prefix,
        ...manifest.levels.map(({ id }) => {
          const content = locale.pages.get(`levels/${id}`)!;
          return Object.freeze({ instance, id, title: content.title,
            description: content.description!, advancementOutcome: content.outcome! });
        }),
        Object.freeze({ instance, id: "terminal", title: locale.pages.get("levels/terminal")!.title,
          description: locale.pages.get("levels/terminal")!.description!, advancementOutcome: null }),
      ]);
      probeWithContext.set(instance, async (context) => {
        if (childInstance !== null) {
          const observation = await probeWithContext.get(childInstance)!(context);
          const localIndex = manifest.prerequisite!.minimumLevelId === undefined
            || manifest.prerequisite!.minimumLevelId === "terminal"
            ? -1 : guideLevels.get(childInstance.guide)!.indexOf(manifest.prerequisite!.minimumLevelId);
          const currentIndex = observation.current.instance === childInstance
            ? observation.current.id === "terminal" ? Number.POSITIVE_INFINITY
              : guideLevels.get(childInstance.guide)!.indexOf(observation.current.id)
            : -1;
          if (minimumLevelId === "terminal"
            ? !(observation.current.instance === childInstance && observation.current.id === "terminal")
            : currentIndex < localIndex) return observation;
        }
        const request: CheckRequest = {
          protocolVersion: 1,
          subject: stableSubject,
          probe: { tempDirectory: context.tempDirectory },
        };
        for (const level of manifest.levels) {
          for (const name of level.advancement.checks) {
            const result = checkResult(await runner.run(manifestUri, name, request), locale);
            if (!result.pass) {
              const current = descriptions.find((entry) => entry.instance === instance && entry.id === level.id)!;
              return Object.freeze({ current, problems: Object.freeze([...result.problems]),
                gapSummary: result.problems.map((problem) => problemSummary(locale, problem)).join("\n") });
            }
          }
        }
        return Object.freeze({ current: descriptions.at(-1)!, problems: Object.freeze([]), gapSummary: "" });
      });
      return { ok: true, instance: Object.freeze(instance) };
    },
  };
  validators.set(guide, domain);
  guideLevels.set(guide, manifest.levels.map(({ id }) => id));
  return Object.freeze(guide);
}
