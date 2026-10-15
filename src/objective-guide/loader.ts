import { AsyncLocalStorage } from "node:async_hooks";
import {
  createObjectiveLoader as createPackageObjectiveLoader,
  fileObjectiveCheckRunner,
  ObjectiveOperationError,
} from "@potential-guide/objective-guide";
import type {
  ObjectiveGuide as PackageGuide,
  ObjectiveGuideInstance as PackageInstance,
  ReferencePage as PackagePage,
} from "@potential-guide/objective-guide";
import type {
  ObjectiveGuide, ObjectiveGuideInstance, ObjectiveLevelDescription,
  ObjectiveLoader, ObjectiveLoaderOptions, ObjectiveSubject, ReferencePage,
} from "./types.ts";

export function createObjectiveLoader(options: ObjectiveLoaderOptions = {}): ObjectiveLoader {
  const failures = new AsyncLocalStorage<Map<string, string>>();
  const runner = options.checkRunner ?? fileObjectiveCheckRunner;
  const validate = runner.validate;
  const loader = createPackageObjectiveLoader({
    ...options,
    checkSchedulingPolicy: () => 1,
    checkRunner: {
      ...(validate === undefined ? {} : {
        validate: (uri: string, id: string) => validate.call(runner, uri, id),
      }),
      async run(uri, id, request, signal) {
        const result = await runner.run(uri, id, request, signal);
        if (typeof result === "object" && result !== null
          && "pass" in result && result.pass === false) {
          const current = failures.getStore();
          if (current !== undefined && !current.has(uri)) current.set(uri, id);
        }
        return result;
      },
    },
  });
  const guides = new WeakMap<PackageGuide, ObjectiveGuide>();
  const instances = new WeakMap<PackageInstance, ObjectiveGuideInstance>();
  const levels = new WeakMap<PackageInstance, readonly ObjectiveLevelDescription[]>();

  function wrapGuide(source: PackageGuide): ObjectiveGuide {
    const cached = guides.get(source);
    if (cached !== undefined) return cached;
    const prerequisite = source.prerequisite;
    const guide: ObjectiveGuide = {
      manifestUri: source.manifestUri,
      domainSchema: source.domainSchema,
      prerequisite: prerequisite === null ? null : Object.freeze({
        guide: wrapGuide(prerequisite.guide),
        minimumLevelId: prerequisite.minimumLevelId,
        mapSubject: (subject: ObjectiveSubject) => prerequisite.mapSubject(subject),
      }),
      createInstance(options) {
        const result = source.createInstance(options);
        if (result.ok) return { ok: true, instance: wrapInstance(result.instance) };
        const error = result.error;
        if (error.type === "invalid-subject") {
          return { ok: false, error: { ...error, guide: wrapGuide(error.guide) } };
        }
        if (error.type === "unsupported-language") {
          return { ok: false, error: {
            ...error, guide: wrapGuide(error.guide),
            chain: [wrapGuide(error.chain[0]), ...error.chain.slice(1).map(wrapGuide)],
          } };
        }
        return { ok: false, error: {
          ...error, guide: wrapGuide(error.guide),
          chain: [wrapGuide(error.chain[0]), wrapGuide(error.chain[1]),
            ...error.chain.slice(2).map(wrapGuide)],
        } };
      },
    };
    guides.set(source, Object.freeze(guide));
    return guide;
  }

  function wrapInstance(source: PackageInstance): ObjectiveGuideInstance {
    const cached = instances.get(source);
    if (cached !== undefined) return cached;
    const instance: ObjectiveGuideInstance = {
      guide: wrapGuide(source.guide),
      subject: source.subject,
      language: source.language,
      title: source.title,
      description: source.description,
      prerequisite: source.prerequisite === null ? null : wrapInstance(source.prerequisite),
      describeLevels() {
        let descriptions = levels.get(source);
        if (descriptions === undefined) {
          descriptions = Object.freeze(source.describeLevels().map((level) =>
            Object.freeze({ ...level, instance: wrapInstance(level.instance) })));
          levels.set(source, descriptions);
        }
        return descriptions;
      },
      async probe(signal) {
        return failures.run(new Map(), async () => {
          const observation = await source.probe(signal);
          const owner = wrapInstance(observation.current.instance);
          const level = owner.describeLevels().find((entry) =>
            entry.instance === owner && entry.id === observation.current.id);
          if (level === undefined) throw new ObjectiveOperationError("Observed level is not owned by its instance.");
          const failingCheck = failures.getStore()?.get(owner.guide.manifestUri) ?? null;
          if (level.id !== "terminal" && failingCheck === null) {
            throw new ObjectiveOperationError("Failed observation omitted its check provenance.");
          }
          return Object.freeze({
            position: Object.freeze({
              owner, level, failingCheck: level.id === "terminal" ? null : failingCheck,
              problems: observation.problems,
            }),
            gapSummary: observation.gapSummary,
          });
        });
      },
      async readPage(id) {
        return referencePage(await source.readPage(id));
      },
      searchPages: (query) => source.searchPages(query),
    };
    instances.set(source, Object.freeze(instance));
    return instance;
  }

  return Object.freeze({ async load(uri: string) { return wrapGuide(await loader.load(uri)); } });
}

function referencePage(page: PackagePage): ReferencePage {
  if ("outcome" in page && (typeof page.outcome !== "string" || page.outcome.trim() === "")) {
    throw new ObjectiveOperationError("Invalid Reference outcome.");
  }
  if ("instruction" in page && (typeof page.instruction !== "string" || page.instruction.trim() === "")) {
    throw new ObjectiveOperationError("Invalid Reference instruction.");
  }
  return Object.freeze({
    ...page,
    ...("outcome" in page && typeof page.outcome === "string" ? { outcome: page.outcome } : {}),
    ...("instruction" in page && typeof page.instruction === "string" ? { instruction: page.instruction } : {}),
  });
}
