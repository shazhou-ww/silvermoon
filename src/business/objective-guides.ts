import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalManifestUri,
  createMemoryCheckProbe,
  describeLevels,
  fileResources,
  loadPilotSpec,
  ObjectiveOperationError,
  observe,
  readPage,
  searchPages,
  startEffect,
} from "../objective-guide/index.ts";
import type {
  CheckResult,
  JsonObject,
  PilotObservation,
  PilotSpec,
  Problem,
  ReferencePage,
  ReferencePageSummary,
  ResourceResolver,
  Subject,
} from "../objective-guide/index.ts";

const OBJECTIVE_REPOSITORY = "git+https://github.com/shazhou-ww/silvermoon.git";
const OBJECTIVE_ROOT = "src/business/objectives/";
export const SILVERMOON_OBJECTIVE_VERSION = "5c256bb76829240dafe648e3d5b7c7198a7927ea";

export const SILVERMOON_OBJECTIVE_URIS = Object.freeze({
  device: `${OBJECTIVE_REPOSITORY}#${OBJECTIVE_ROOT}device/manifest.yaml`,
  project: `${OBJECTIVE_REPOSITORY}#${OBJECTIVE_ROOT}project/manifest.yaml`,
  idea: `${OBJECTIVE_REPOSITORY}#${OBJECTIVE_ROOT}idea/manifest.yaml`,
});
export const SILVERMOON_OBJECTIVE_LEVELS = Object.freeze({
  device: [
    ["configuration-invalid", ["device-config-valid"], "Valid personal configuration", "个人配置合法"],
    ["runtime-unready", ["device-runtime-linked"], "Recognized device runtime", "设备运行时可识别"],
    ["skill-unready", ["device-skill-discoverable"], "Discoverable canonical skill", "canonical skill 可发现"],
    ["update-unconfirmed", ["device-update-current"], "Confirmed runtime update status", "运行时更新状态已确认"],
  ],
  project: [
    ["configuration-invalid", ["project-config-valid", "project-user-config-valid", "project-layout-valid"], "Valid project configuration", "项目配置合法"],
    ["project-unprepared", ["project-adopted", "project-schema-ready", "project-guidance-valid"], "Prepared project", "项目已整备"],
    ["repository-unready", ["repository-worktree-clean", "repository-head-present", "repository-upstream-matches"], "Safe local repository", "本地仓库可安全同步"],
    ["primary-unconfirmed", ["repository-primary-fetched", "repository-primary-aligned", "repository-event-history-valid", "project-primary-guidance-valid"], "Confirmed primary snapshot", "primary snapshot 已确认"],
  ],
  idea: [
    ["configuration-invalid", ["idea-metadata-valid", "idea-contracts-valid"], "Valid selected Idea", "所选 Idea 配置合法"],
    ["ideal-unsubmitted", ["idea-ideal-submitted"], "Submit exact Ideal revision", "提交准确 Ideal revision"],
    ["ideal-unaccepted", ["idea-ideal-accepted"], "Accept exact Ideal revision", "接受准确 Ideal revision"],
    ["implementation-unsubmitted", ["idea-inner-submitted"], "Submit exact Inner revision", "提交准确 Inner revision"],
    ["implementation-unaccepted", ["idea-inner-accepted"], "Accept exact Inner revision", "接受准确 Inner revision"],
    ["deployment-unsubmitted", ["idea-outer-submitted"], "Submit exact Outer revision", "提交准确 Outer revision"],
    ["deployment-unaccepted", ["idea-outer-accepted"], "Accept exact Outer revision", "接受准确 Outer revision"],
  ],
} as const);
export const SILVERMOON_CHECK_PROBLEMS = Object.freeze({
  "device-config-valid": ["device-configuration"],
  "device-runtime-linked": ["device-runtime"],
  "device-skill-discoverable": ["device-skill"],
  "device-update-current": ["device-update"],
  "project-config-valid": ["project-configuration"],
  "project-user-config-valid": ["project-user-configuration"],
  "project-layout-valid": ["project-layout"],
  "project-adopted": ["project-adoption"],
  "project-schema-ready": ["project-schema"],
  "project-guidance-valid": ["project-guidance"],
  "repository-worktree-clean": ["repository-worktree"],
  "repository-head-present": ["repository-head"],
  "repository-upstream-matches": ["repository-upstream"],
  "repository-primary-fetched": ["repository-primary-fetch"],
  "repository-primary-aligned": ["repository-primary-alignment"],
  "repository-event-history-valid": ["repository-event-history"],
  "project-primary-guidance-valid": ["project-primary-guidance"],
  "idea-metadata-valid": [
    "idea-selection-changed",
    "idea-metadata",
    "idea-revision-changed",
    "idea-guidance",
    "idea-inactive",
  ],
  "idea-contracts-valid": ["idea-contracts"],
  "idea-ideal-submitted": ["ideal-unsubmitted"],
  "idea-ideal-accepted": ["ideal-unaccepted"],
  "idea-inner-submitted": ["implementation-unsubmitted"],
  "idea-inner-accepted": ["implementation-unaccepted"],
  "idea-outer-submitted": ["deployment-unsubmitted"],
  "idea-outer-accepted": ["deployment-unaccepted"],
} as const);

interface LegacyPageMetadata {
  readonly outcome?: string;
  readonly instruction?: string;
}
export interface SilvermoonReferencePage extends ReferencePage, LegacyPageMetadata {}
export interface SilvermoonObjectiveContext {
  readonly spec: PilotSpec;
  readonly guide: { readonly manifestUri: string };
  readonly language: string;
  readonly prerequisite: SilvermoonObjectiveContext | null;
  readPage(pageId: string): SilvermoonReferencePage;
  searchPages(query: string): readonly ReferencePageSummary[];
}
export interface SilvermoonObjectiveObservation {
  readonly position: {
    readonly owner: SilvermoonObjectiveContext;
    readonly level: { readonly id: string };
    readonly failingCheck: string | null;
    readonly problems: readonly { readonly id: string; readonly parameters: JsonObject }[];
  };
  readonly gapSummary: string;
  readonly observedAt: string;
  readonly versions: Readonly<Record<string, string>>;
}

export type SilvermoonCheckId = keyof typeof SILVERMOON_CHECK_PROBLEMS;
export type SilvermoonObjectiveCheck = (subject: Subject) => Promise<CheckResult>;
export type SilvermoonObjectiveChecks = Readonly<Record<SilvermoonCheckId, SilvermoonObjectiveCheck>>;
export interface SilvermoonObjectiveLoader {
  load(uri: string): Promise<PilotSpec>;
  probe(
    spec: PilotSpec,
    subject: Subject,
    language: string,
    signal?: AbortSignal,
  ): Promise<SilvermoonObjectiveObservation>;
}

const localRoot = new URL("./objectives/", import.meta.url);
const pageMetadata = new Map<string, LegacyPageMetadata>();

function localResource(uri: string): URL {
  const canonical = canonicalManifestUri(uri);
  const fragment = decodeURIComponent(new URL(canonical).hash.slice(1));
  if (!canonical.startsWith(OBJECTIVE_REPOSITORY) || !fragment.startsWith(OBJECTIVE_ROOT)) {
    throw new ObjectiveOperationError(`Unknown bundled Objective resource: ${uri}.`);
  }
  return new URL(fragment.slice(OBJECTIVE_ROOT.length), localRoot);
}

function adaptPage(uri: string, source: string): string {
  const metadata: { outcome?: string; instruction?: string } = {};
  const adapted = source.replace(
    /^(outcome|instruction):[ \t]*(.+)\r?\n/gm,
    (_line, field: "outcome" | "instruction", encoded: string) => {
      const value: unknown = JSON.parse(encoded);
      if (typeof value !== "string" || value.trim() === "") {
        throw new ObjectiveOperationError(`Invalid ${field} metadata: ${uri}.`);
      }
      metadata[field] = value;
      return "";
    },
  );
  pageMetadata.set(uri, Object.freeze(metadata));
  return adapted;
}

const bundledResources: ResourceResolver = {
  version: SILVERMOON_OBJECTIVE_VERSION,
  versionFor: async () => SILVERMOON_OBJECTIVE_VERSION,
  readText: async (uri) => fileResources.readText(localResource(uri).href),
  async readPages(uri) {
    const local = localResource(uri);
    const pages = await fileResources.readPages(local.href);
    return pages.map((page) => {
      const path = relative(fileURLToPath(local), fileURLToPath(page.uri))
        .split(sep)
        .join("/");
      const resourceUri = canonicalManifestUri(path, uri);
      return {
        uri: resourceUri,
        source: adaptPage(resourceUri, page.source),
      };
    });
  },
};

function findSpec(root: PilotSpec, objectiveId: string): PilotSpec {
  let current: PilotSpec | undefined = root;
  while (current !== undefined) {
    if (current.objectiveId === objectiveId) return current;
    current = current.prerequisite;
  }
  throw new ObjectiveOperationError(`Observation referenced an unknown Objective: ${objectiveId}.`);
}

function pageResourceUri(spec: PilotSpec, pageId: string, language: string) {
  return canonicalManifestUri(`references/${pageId}/${language}.md`, spec.objectiveId);
}

function context(spec: PilotSpec, language: string): SilvermoonObjectiveContext {
  return Object.freeze({
    spec,
    guide: Object.freeze({ manifestUri: spec.objectiveId }),
    language,
    prerequisite: spec.prerequisite === undefined
      ? null
      : context(spec.prerequisite, language),
    readPage(pageId: string) {
      const page = readPage(spec, pageId, language);
      const metadata = pageMetadata.get(pageResourceUri(spec, page.id, language));
      return Object.freeze({ ...page, ...metadata });
    },
    searchPages: (query: string) => searchPages(spec, query, language),
  });
}

function problemResult(problem: Problem) {
  return Object.freeze({
    id: problem.ref.problemId,
    parameters: problem.parameters,
  });
}

function projectObservation(
  root: PilotSpec,
  language: string,
  observation: PilotObservation,
): SilvermoonObjectiveObservation {
  const ownerSpec = findSpec(root, observation.current.objectiveId);
  const owner = context(ownerSpec, language);
  return Object.freeze({
    position: Object.freeze({
      owner,
      level: Object.freeze({ id: observation.current.levelId }),
      failingCheck: observation.current.levelId === "terminal"
        ? null
        : observation.problems[0]?.ref.checkId ?? null,
      problems: Object.freeze(observation.problems.map(problemResult)),
    }),
    gapSummary: observation.gapSummary,
    observedAt: observation.observedAt,
    versions: observation.versions,
  });
}

export function createSilvermoonObjectiveLoader(
  checks: SilvermoonObjectiveChecks,
): SilvermoonObjectiveLoader {
  const specifications = new Map<string, Promise<PilotSpec>>();
  return Object.freeze({
    load(uri: string) {
      const canonical = canonicalManifestUri(uri);
      let pending = specifications.get(canonical);
      if (pending === undefined) {
        pending = loadPilotSpec(canonical, bundledResources);
        specifications.set(canonical, pending);
        void pending.catch(() => specifications.delete(canonical));
      }
      return pending;
    },
    async probe(
      spec: PilotSpec,
      subject: Subject,
      language: string,
      signal?: AbortSignal,
    ) {
      const effect = observe(
        { spec, subject, language },
        {
          resolveCheck(ref) {
            const check = checks[ref.checkId as SilvermoonCheckId];
            if (check === undefined) {
              throw new ObjectiveOperationError(`Missing bundled check: ${ref.checkId}.`);
            }
            return createMemoryCheckProbe(async (input) => ({
              status: 200,
              payload: await check(input),
              message: "",
            }));
          },
        },
      );
      const envelope = await startEffect(effect, signal).await();
      if (envelope.status !== 200 || envelope.payload === null) {
        throw new ObjectiveOperationError(
          `Objective observation failed (${envelope.status}): ${envelope.message}`,
        );
      }
      return projectObservation(spec, language, envelope.payload);
    },
  });
}

export function probeObjective(
  loader: SilvermoonObjectiveLoader,
  spec: PilotSpec,
  subject: Subject,
  language: string,
  signal?: AbortSignal,
) {
  return loader.probe(spec, subject, language, signal);
}

export function silvermoonObjectiveContext(spec: PilotSpec, language: string) {
  if (!spec.manifest.languages.includes(language)) {
    throw new ObjectiveOperationError(
      `Unsupported Reference locale: ${language}. Supported locales: ${
        spec.manifest.languages.join(", ")
      }.`,
    );
  }
  return context(spec, language);
}

export function describeSilvermoonObjectiveLevels(spec: PilotSpec) {
  return describeLevels(spec);
}
