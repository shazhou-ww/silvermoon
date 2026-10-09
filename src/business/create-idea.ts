import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { cleanupScaffold, cleanupSummary, createScaffold } from "../foundation/owned-write/index.ts";
import { encodeUlid } from "../foundation/idea-model/index.ts";

import { createCommandRun } from "../foundation/command-message/index.ts";
import { diagnosticProblem, dialogueReadyObservation } from "../foundation/report/index.ts";
import { localize } from "../foundation/language/index.ts";
import { inspectPhaseGuidance } from "../foundation/guidance/index.ts";
import { ideaTemplates } from "../foundation/idea-template/index.ts";
import { phaseGuidanceInstructions, projectInstructions } from "../foundation/report/index.ts";
import { canonicalizeLanguageTag } from "../foundation/language/index.ts";
import { observeSnapshot } from "./shared/index.ts";
import { assessIdeaCreationReadiness } from "./shared/index.ts";
import type {
  CommandRuntime,
  Diagnostic,
  Problem,
  ProjectObservation,
} from "./shared/business-types.ts";
import { errorMessage } from "./shared/business-types.ts";
import type {
  IdeaCreatedObservation,
  Observation,
  ProjectReadyObservation,
  RepositoryBlockedObservation,
} from "../foundation/report/types.ts";

interface CreateIdeaOptions {
  generateId?: typeof generateUlid;
  guidanceReader?: typeof inspectPhaseGuidance;
  language?: string;
  operations?: NonNullable<Parameters<typeof createScaffold>[0]["operations"]>;
  root?: string;
  userHome?: string;
}

export function generateUlid({
  now = Date.now(),
  random = randomBytes(10),
}: { now?: number; random?: Buffer } = {}): string {
  return encodeUlid({ now, random });
}

function failureReport({
  cleanup,
  problem: actionProblem,
  observation,
  runtime,
  language,
}: {
  cleanup: Awaited<ReturnType<typeof cleanupScaffold>>;
  problem: Problem;
  observation: ProjectReadyObservation;
  runtime: CommandRuntime;
  language: string;
}) {
  const problem = {
    type: "idea-scaffold-failed",
    summary: localize(
      language,
      `Idea creation failed: ${actionProblem.summary} ${cleanupSummary(cleanup.items)}`,
      `创建 idea 失败：${actionProblem.summary} ${cleanupSummary(cleanup.items)}`,
    ),
  };
  return runtime.complete(
    dialogueReadyObservation(observation, "idea-create-failed", {
      cleanup,
      problems: [...observation.problems, problem],
    }),
    {
      nextSteps: localize(
        language,
        "Preserve any reported paths, resolve the filesystem error, and retry `silvermoon create-idea`.",
        "保留报告中的路径，解决文件系统错误后，再运行 `silvermoon create-idea`。",
      ),
    },
  );
}

function projectCreationObservation(observation: ProjectObservation): Observation {
  if (observation.state === "project-setup-required") {
    if (observation.observedThrough !== "ideas") return observation;
    const { ideas: _ideas, ...project } = observation;
    return { ...project, observedThrough: "configuration" };
  }
  if (observation.state !== "project-ready") return observation;
  return {
    state: "project-setup-required",
    observedThrough: "configuration",
    root: observation.root,
    version: observation.version,
    configuration: observation.configuration,
    ...(observation.device === undefined ? {} : { device: observation.device }),
    ...(observation.schemas === undefined
      ? {}
      : { schemas: observation.schemas }),
    outputLanguage: observation.outputLanguage,
    problems: observation.problems,
  };
}

function cleanupPlan(value: unknown): Parameters<typeof cleanupScaffold>[0] {
  if (
    value === null || typeof value !== "object"
    || !("cleanupFiles" in value) || !Array.isArray(value.cleanupFiles)
    || !value.cleanupFiles.every((item) =>
      Array.isArray(item) && item.length === 2
      && typeof item[0] === "string"
      && (typeof item[1] === "string" || item[1] instanceof Uint8Array))
    || !("collisionPath" in value)
    || (typeof value.collisionPath !== "string" && value.collisionPath !== null)
    || !("createdDirectories" in value) || !Array.isArray(value.createdDirectories)
    || !value.createdDirectories.every((item) => typeof item === "string")
    || !("rootDirectories" in value) || !Array.isArray(value.rootDirectories)
    || !value.rootDirectories.every((item) => typeof item === "string")
  ) {
    throw new TypeError("Idea scaffold failure returned an invalid cleanup plan.");
  }
  const cleanupFiles: Parameters<typeof cleanupScaffold>[0]["cleanupFiles"] = [];
  for (const item of value.cleanupFiles) {
    if (
      !Array.isArray(item) || typeof item[0] !== "string"
      || (typeof item[1] !== "string" && !(item[1] instanceof Uint8Array))
    ) {
      throw new TypeError("Idea scaffold cleanup file is invalid.");
    }
    cleanupFiles.push([item[0], item[1]]);
  }
  return {
    cleanupFiles,
    collisionPath: value.collisionPath,
    createdDirectories: [...value.createdDirectories],
    rootDirectories: [...value.rootDirectories],
  };
}

const CREATEIDEA_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessIdeaCreationReadiness, createScaffold, cleanupScaffold });

export async function createIdeaUseCase({
  generateId = generateUlid,
  guidanceReader = inspectPhaseGuidance,
  language,
  operations = {},
  root = process.cwd(),
  userHome,
}: CreateIdeaOptions = {}, ports: typeof CREATEIDEA_PORTS = CREATEIDEA_PORTS) {
  const { createCommandRun, observeSnapshot, assessIdeaCreationReadiness, createScaffold, cleanupScaffold } = ports;
  const requestedRoot = resolve(root);
  const canonicalLanguage = language === undefined
    ? undefined
    : canonicalizeLanguageTag(language);
  const intention = {
    command: "create-idea",
    args: { language: canonicalLanguage ?? null },
  };
  const runtime = createCommandRun(intention);
  const observed = await observeSnapshot({
    allowMissingIdeas: true,
    ideaLanguage: canonicalLanguage,
    root: requestedRoot,
    userHome,
    version: { type: "worktree" },
  });
  runtime.observe(projectCreationObservation(observed.observation), {
    factType: "project.snapshot",
  });
  const recheckCommand = canonicalLanguage === undefined
    ? "silvermoon create-idea"
    : `silvermoon create-idea --language ${canonicalLanguage}`;
  if (!observed.projectReady) {
    return runtime.complete(
      projectCreationObservation(observed.observation),
      {
        nextSteps: projectInstructions(
          observed,
          observed.observation.root,
          observed.outputLanguage,
          recheckCommand,
        ),
      },
    );
  }
  const repositoryRoot = observed.observation.root;
  const readiness = await assessIdeaCreationReadiness({
    observed,
    runtime,
    recheckCommand,
    root: repositoryRoot,
  });
  if (!readiness.ready) {
    const { observation } = readiness;
    if (observation.version === undefined || observation.configuration === undefined) {
      throw new TypeError("Repository preparation observation omitted project identity.");
    }
    const preparationObservation: RepositoryBlockedObservation = {
      state: "repository-preparation-required",
      root: observation.root,
      version: observation.version,
      configuration: observation.configuration,
      outputLanguage: observation.outputLanguage,
      problems: observation.problems,
    };
    return runtime.complete(
      preparationObservation,
      { nextSteps: readiness.instructions },
    );
  }

  const inspectedGuidance = await guidanceReader({
    gitRoot: repositoryRoot,
    phase: "preparing",
    snapshotTree: readiness.head,
  });
  if (inspectedGuidance.state === "invalid") {
    return runtime.complete(
      dialogueReadyObservation(
        readiness.observation,
        "phase-guidance-invalid",
        {
          problems: inspectedGuidance.diagnostics.map((diagnostic: Diagnostic) =>
            diagnosticProblem(diagnostic, observed.outputLanguage)
          ),
        },
      ),
      {
        nextSteps: phaseGuidanceInstructions(
          inspectedGuidance.diagnostics,
          repositoryRoot,
          observed.outputLanguage,
          recheckCommand,
        ),
      },
    );
  }

  const completion = await runtime.performAction(
    {
      type: "create-idea-scaffold",
      contentLanguage: observed.contentLanguage,
    },
    () => createScaffold({
      ...(canonicalLanguage === undefined ? {} : { canonicalLanguage }),
      contentLanguage: observed.contentLanguage,
      formatVersion: observed.config.version,
      generateId,
      ...(Object.keys(operations).length === 0 ? {} : { operations }),
      repositoryRoot,
    }),
    (caught) => ({
      problem: {
        type: "idea-scaffold-failed",
        summary: errorMessage(caught),
      },
      internal: {
        cleanupPlan: caught instanceof Error && "cleanupPlan" in caught
          ? caught.cleanupPlan
          : [],
      },
    }),
  );
  if (completion.status === "failure") {
    const cleanupCompletion = await runtime.performAction(
      { type: "remove-owned-creation-paths" },
      () => cleanupScaffold(
        cleanupPlan(completion.internal?.cleanupPlan),
        ...(Object.keys(operations).length === 0 ? [] : [operations]),
      ),
      (caught) => ({
        problem: {
          type: "idea-cleanup-failed",
          summary: errorMessage(caught),
        },
      }),
    );
    const cleanup: Awaited<ReturnType<typeof cleanupScaffold>> =
      cleanupCompletion.status === "success"
        ? cleanupCompletion.result
        : {
        removed: 0,
        preserved: 1,
        items: [{
          path: repositoryRoot,
          status: "preserved",
          error: cleanupCompletion.problem.summary,
        }],
        };
    return failureReport({
      cleanup,
      problem: completion.problem,
      observation: readiness.observation,
      runtime,
      language: observed.outputLanguage,
    });
  }

  const { createdIdea, paths } = completion.result;
  const templates = ideaTemplates(observed.contentLanguage);
  const languageInstruction = templates.localized
    ? localize(
      observed.outputLanguage,
      `Use ${observed.contentLanguage} for all natural-language content in the canonical idea documents and ledger.`,
      `在 canonical idea 文档和 ledger 的所有自然语言内容中使用 ${observed.contentLanguage}。`,
    )
    : localize(
      observed.outputLanguage,
      `Silvermoon has no built-in ${observed.contentLanguage} scaffold, so the new files contain explicit ${templates.templateLanguage} fallback placeholders. Replace all natural-language placeholders with ${observed.contentLanguage} before continuing.`,
      `Silvermoon 没有内置的 ${observed.contentLanguage} 脚手架，因此新文件包含明确的 ${templates.templateLanguage} fallback 占位。继续前，将所有自然语言占位替换为 ${observed.contentLanguage}。`,
    );
  const creationObservation: IdeaCreatedObservation = {
    state: "idea-created",
    root: readiness.observation.root,
    version: readiness.observation.version,
    configuration: readiness.observation.configuration,
    ...(readiness.observation.device === undefined
      ? {}
      : { device: readiness.observation.device }),
    ...(readiness.observation.schemas === undefined
      ? {}
      : { schemas: readiness.observation.schemas }),
    outputLanguage: readiness.observation.outputLanguage,
    problems: readiness.observation.problems,
    createdIdea,
    ...(inspectedGuidance.state !== "valid"
      || inspectedGuidance.guidance === undefined
      ? {}
      : { guidance: inspectedGuidance.guidance }),
  };
  return runtime.complete(
    creationObservation,
    {
      nextSteps: localize(
        observed.outputLanguage,
        `${languageInstruction} Complete the requested Ideal World in ${paths.ideaDocumentPath}. Before requesting Ideal approval, replace the placeholders in ${paths.implementationDocumentPath} and ${paths.deploymentDocumentPath} with lightweight first versions of no more than three high-level steps and three observable criteria each, then mirror their stable IDs and short titles in ${paths.ledgerPath}. Ideal approval covers only ${paths.ideaDocumentPath}; the two downstream versions remain provisional.`,
        `${languageInstruction} 在 ${paths.ideaDocumentPath} 中完成请求的理想契约。请求 Ideal 批准前，把 ${paths.implementationDocumentPath} 和 ${paths.deploymentDocumentPath} 中的占位替换为轻量初版；每份最多三个高层步骤和三个可观察标准，并在 ${paths.ledgerPath} 中镜像其稳定 ID 与短标题。Ideal 批准只覆盖 ${paths.ideaDocumentPath}；两份下游初版仍可调整。`,
      ),
    },
  );
}

export async function createIdea(options: CreateIdeaOptions = {}) {
  return createIdeaUseCase(options);
}
