import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { cleanupScaffold, cleanupSummary, createScaffold } from "./idea-scaffold.js";
import { encodeUlid } from "./ulid.js";

import { createCommandRun } from "./command-runtime.js";
import {
  diagnosticProblem,
  dialogueReadyObservation,
  localize,
} from "./dialogue.js";
import { inspectPhaseGuidance } from "./guidance.js";
import {
  ideaTemplates,
} from "./idea-templates.js";
import { phaseGuidanceInstructions, projectInstructions } from "./instructions.js";
import { canonicalizeLanguageTag } from "./language.js";
import { observeSnapshot } from "./observation.js";
import { assessIdeaCreationReadiness } from "./repository-readiness.js";

export function generateUlid({ now = Date.now(), random = randomBytes(10) } = {}) {
  return encodeUlid({ now, random });
}

function failureReport({
  cleanup,
  problem: actionProblem,
  observation,
  runtime,
  language,
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

function projectCreationObservation(observation) {
  const { ideas: _ideas, ...project } = observation;
  if (project.observedThrough === "ideas") {
    project.observedThrough = "configuration";
  }
  return project;
}

const CREATEIDEA_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessIdeaCreationReadiness, createScaffold, cleanupScaffold });

export async function createIdeaUseCase({
  generateId = generateUlid,
  guidanceReader = inspectPhaseGuidance,
  language,
  operations = {},
  root = process.cwd(),
  userHome,
} = {}, ports = CREATEIDEA_PORTS) {
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
    return runtime.complete(
      dialogueReadyObservation(
        readiness.observation,
        "repository-preparation-required",
      ),
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
          problems: inspectedGuidance.diagnostics.map((diagnostic) =>
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
      canonicalLanguage,
      contentLanguage: observed.contentLanguage,
      formatVersion: observed.config.version,
      generateId,
      operations,
      repositoryRoot,
    }),
    (caught) => ({
      problem: {
        type: "idea-scaffold-failed",
        summary: caught.message,
      },
      internal: { cleanupPlan: caught.cleanupPlan },
    }),
  );
  if (completion.status === "failure") {
    const cleanupCompletion = await runtime.performAction(
      { type: "remove-owned-creation-paths" },
      () => cleanupScaffold(
        completion.internal.cleanupPlan,
        operations,
      ),
      (caught) => ({
        problem: {
          type: "idea-cleanup-failed",
          summary: caught.message,
        },
      }),
    );
    const cleanup = cleanupCompletion.status === "success"
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
  return runtime.complete(
    dialogueReadyObservation(readiness.observation, "idea-created", {
      createdIdea,
      ...(inspectedGuidance.guidance === undefined
        ? {}
        : { guidance: inspectedGuidance.guidance }),
    }),
    {
      nextSteps: localize(
        observed.outputLanguage,
        `${languageInstruction} Describe the requested Ideal World in ${paths.ideaDocumentPath}; keep canonical headings, stable IDs, and placeholders in ${paths.implementationDocumentPath}, ${paths.deploymentDocumentPath}, and ${paths.ledgerPath} synchronized.`,
        `${languageInstruction} 在 ${paths.ideaDocumentPath} 中描述请求的理想契约；保持 ${paths.implementationDocumentPath}、${paths.deploymentDocumentPath} 与 ${paths.ledgerPath} 中的 canonical 标题、稳定 ID 和占位同步。`,
      ),
    },
  );
}

export async function createIdea(options = {}) {
  return createIdeaUseCase(options);
}
