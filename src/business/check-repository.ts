import { resolve } from "node:path";

import { createCommandRun } from "../foundation/command-message/index.ts";
import { loadConfigSnapshot } from "../foundation/project-config/index.ts";
import { diagnosticProblem } from "../foundation/report/index.ts";
import { inspectEventHistory } from "../foundation/event-history/index.ts";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.ts";
import { fetchPrimary, indexSnapshot, resolveSnapshot, runGit, sanitizeGitMessage, worktreeSnapshot } from "../foundation/git/index.ts";
import { canonicalizeOutputLanguage, DEFAULT_LANGUAGE } from "../foundation/language/index.ts";
import { CONFIG_PATH, GUIDANCE_ROOT, IDEAS_ROOT } from "../foundation/coordinates/index.ts";
import {
  observeSnapshot,
} from "./shared/index.ts";
import { unavailableObservation } from "../foundation/report/index.ts";
import type {
  CommandRuntime,
  Problem,
  SnapshotObservation,
} from "./shared/business-types.ts";
import { errorMessage } from "./shared/business-types.ts";
import { asBusinessFileSystem } from "./shared/business-types.ts";
import type { ProjectVersion } from "../foundation/report/types.ts";
import type {
  CheckUnavailableObservation,
  IdeaCounts,
  IdeaInventoryItem,
  IdeaSummary,
  ProjectConfiguration,
} from "../foundation/report/types.ts";

type CheckFailureObservation = CheckUnavailableObservation & {
  eventHistory: object;
  configuration?: ProjectConfiguration;
  ideas?:
    | IdeaSummary
    | IdeaInventoryItem[]
    | { counts: IdeaCounts; activeIdeas: IdeaInventoryItem[] };
};

function checkFailureObservation(
  observed: SnapshotObservation,
  eventHistory: object,
  problems = observed.observation.problems,
): CheckFailureObservation {
  return {
    state: "check-unavailable",
    root: observed.observation.root,
    outputLanguage: observed.observation.outputLanguage,
    problems,
    eventHistory,
    ...("version" in observed.observation && observed.observation.version !== undefined
      ? { version: observed.observation.version }
      : {}),
    ...("configuration" in observed.observation
      && observed.observation.configuration !== undefined
      ? { configuration: observed.observation.configuration }
      : {}),
    ...("ideas" in observed.observation && observed.observation.ideas !== undefined
      ? { ideas: observed.observation.ideas }
      : {}),
    ...(observed.observation.schemas === undefined
      ? {}
      : { schemas: observed.observation.schemas }),
  };
}

interface CheckRepositoryOptions {
  commit?: string;
  language?: string;
  remote?: boolean;
  root?: string;
  staged?: boolean;
  userHome?: string;
  worktree?: boolean;
}

function preloadCheckBlob({ name }: { name: string }): boolean {
  return (
    name === CONFIG_PATH
    || name.startsWith(`${GUIDANCE_ROOT}/`)
    || (
      name.startsWith(`${IDEAS_ROOT}/`)
      && (name.endsWith("/status.yaml") || name.endsWith("/events.jsonl"))
    )
  );
}

function targetArgument({
  commit,
  remote,
  staged,
  worktree,
}: {
  commit: string | undefined;
  remote: boolean;
  staged: boolean;
  worktree: boolean;
}) {
  if (remote) return { type: "remote" };
  if (commit !== undefined) return { type: "commit", revision: commit };
  if (staged) return { type: "staged" };
  if (worktree) return { type: "worktree" };
  return { type: "head" };
}

function failureReport({
  runtime,
  outputLanguage,
  problem,
  root,
  version,
}: {
  runtime: CommandRuntime;
  outputLanguage: string;
  problem: Problem;
  root: string;
  version: ProjectVersion;
}) {
  return runtime.complete(
    unavailableObservation({
      outputLanguage,
      problem,
      root,
      version,
    }),
    {},
    { factType: "validation.failed" },
  );
}

async function inspectTree({
  gitRoot,
  outputLanguage,
  root,
  tree,
  userHome,
  version,
}: {
  gitRoot: string;
  outputLanguage?: string | undefined;
  root: string;
  tree: string;
  userHome?: string | undefined;
  version: ProjectVersion;
}): Promise<SnapshotObservation> {
  const filesystem = createGitSnapshotFileSystem({
    gitRoot,
    preload: preloadCheckBlob,
    root,
    tree,
  });
  const observed = await observeSnapshot({
    contentRoot: root,
    filesystem: asBusinessFileSystem(filesystem),
    gitRoot,
    ...(outputLanguage === undefined ? {} : { outputLanguage }),
    root,
    projectOnly: true,
    snapshotTree: tree,
    ...(userHome === undefined ? {} : { userHome }),
    version,
  });
  const eventHistoryConfig = observed.config?.version === 2 ? observed.config : null;
  if (observed.config?.version === 1) {
    const currentCommit = typeof version.commit === "string"
      ? version.commit
      : "HEAD";
    const current = runGit(gitRoot, ["cat-file", "-p", currentCommit]);
    if (!current.ok) throw new Error("Cannot inspect the candidate's first parent.");
    const header = current.stdout.split("\n\n")[0] ?? "";
    const parent = /^parent ([0-9a-f]+)$/m.exec(header)?.[1];
    const base = version.type === "worktree" || version.type === "staged"
      ? currentCommit : parent;
    if (base) {
      const previousConfig = await loadConfigSnapshot({ gitRoot, tree: base });
      if (previousConfig.config?.version === 2) {
        observed.observation.problems.push({
          type: "idea.events.downgrade", summary: "A v2 event project cannot be downgraded to mutable v1 status.",
        });
        observed.observation.state = "check-unavailable";
        return observed;
      }
    }
  }
  if (eventHistoryConfig) {
    try {
      const eventHistory = await inspectEventHistory({
        root: gitRoot,
        tree,
        config: eventHistoryConfig,
        ...(typeof version.commit === "string" ? { commit: version.commit } : {}),
        ...(version.type === "remote" && typeof version.commit === "string"
          ? { primary: version.commit }
          : {}),
      });
      if (!observed.projectReady) {
        return {
          ...observed,
          observation: checkFailureObservation(observed, eventHistory),
        };
      }
      return {
        ...observed,
        observation: { ...observed.observation, eventHistory },
      };
    } catch (caught) {
      const eventHistory = {
        valid: false, error: errorMessage(caught), candidateSnapshotValid: observed.projectReady,
        ...(caught instanceof Error && "eventBaseline" in caught ? { baseline: caught.eventBaseline } : {}),
        ...(caught instanceof Error && "eventStage" in caught ? { unavailableStage: caught.eventStage } : {}),
        ...(caught instanceof Error && "eventCheck" in caught ? { result: caught.eventCheck } : {}),
      };
      return {
        ...observed,
        projectReady: false,
        observation: checkFailureObservation(
          observed,
          eventHistory,
          [...observed.observation.problems, {
            type: "idea.events.history-invalid",
            summary: errorMessage(caught),
          }],
        ),
      };
    }
  }
  return observed;
}

function finishCheck(runtime: CommandRuntime, observed: SnapshotObservation) {
  return runtime.complete(
    observed.observation,
    {},
    { factType: "validation.completed" },
  );
}

const CHECKREPOSITORY_PORTS = Object.freeze({ createCommandRun, runGit, observeSnapshot, loadConfigSnapshot, resolveSnapshot, indexSnapshot, worktreeSnapshot, fetchPrimary, inspectTree });

export async function checkRepositoryUseCase({
  commit,
  language,
  remote = false,
  root = process.cwd(),
  staged = false,
  userHome,
  worktree = false,
}: CheckRepositoryOptions = {}, ports: typeof CHECKREPOSITORY_PORTS = CHECKREPOSITORY_PORTS) {
  const { createCommandRun, runGit, observeSnapshot, loadConfigSnapshot, resolveSnapshot, indexSnapshot, worktreeSnapshot, fetchPrimary, inspectTree } = ports;
  const canonicalLanguage = language === undefined
    ? undefined
    : canonicalizeOutputLanguage(language);
  const fallbackOutputLanguage = canonicalLanguage ?? DEFAULT_LANGUAGE;
  const requestedRoot = resolve(root);
  const targetCount = [remote, commit !== undefined, staged, worktree]
    .filter(Boolean).length;
  if (targetCount > 1) {
    const error = new Error(
      "Check targets are mutually exclusive; choose one of remote, commit, staged, or worktree.",
    );
    Object.defineProperty(error, "exitCode", { value: 2, enumerable: true });
    throw error;
  }
  const target = targetArgument({ commit, remote, staged, worktree });
  const intention = {
    command: "check",
    args: {
      target,
      language: canonicalLanguage ?? null,
    },
  };
  const runtime = createCommandRun(intention);
  const repository = runGit(requestedRoot, ["rev-parse", "--show-toplevel"]);
  if (!repository.ok) {
    const observed = await observeSnapshot({
      outputLanguage: canonicalLanguage,
      projectOnly: true,
      root: requestedRoot,
      userHome,
      version: target.type === "commit" || target.type === "head"
        ? { type: "commit", commit: null }
        : target.type === "remote"
          ? { type: "remote", commit: null }
          : { type: target.type },
    });
    return finishCheck(runtime, observed);
  }
  const repositoryRoot = resolve(repository.stdout);

  if (remote) {
    let head;
    try {
      head = resolveSnapshot(repositoryRoot, "HEAD");
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "head-unavailable",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "remote", commit: null },
      });
    }
    let bootstrap;
    try {
      bootstrap = await loadConfigSnapshot({
        gitRoot: repositoryRoot,
        tree: head.tree,
      });
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "snapshot-inspection-failed",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "remote", commit: null },
      });
    }
    if (!bootstrap.config) {
      return runtime.complete({
        state: "project-setup-required",
        observedThrough: "version",
        root: repositoryRoot,
        version: { type: "remote", commit: null },
        outputLanguage: fallbackOutputLanguage,
        problems: bootstrap.diagnostics.map((diagnostic) =>
          diagnosticProblem({
            ...diagnostic,
            code: diagnostic.code ?? "configuration.invalid",
          }, fallbackOutputLanguage)
        ),
      });
    }
    const bootstrapConfig = bootstrap.config;

    const fetched = await runtime.performAction(
      {
        type: "fetch-primary",
        repository: bootstrapConfig.primaryRepository,
        branch: bootstrapConfig.primaryBranch,
      },
      () => ({
        commit: fetchPrimary(repositoryRoot, bootstrapConfig),
      }),
      (caught) => ({
        problem: {
          type: "primary-fetch-failed",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
      }),
    );
    if (fetched.status === "failure") {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        root: repositoryRoot,
        version: { type: "remote", commit: null },
        problem: fetched.problem,
      });
    }
    const primary = fetched.result.commit;
    try {
      const snapshot = resolveSnapshot(repositoryRoot, primary);
      const observed = await inspectTree({
        gitRoot: repositoryRoot,
        outputLanguage: canonicalLanguage,
        root: repositoryRoot,
        tree: snapshot.tree,
        userHome,
        version: { type: "remote", commit: primary },
      });
      return finishCheck(runtime, observed);
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "snapshot-inspection-failed",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "remote", commit: primary },
      });
    }
  }

  if (commit !== undefined || (!staged && !worktree)) {
    const revision = commit ?? "HEAD";
    let snapshot;
    try {
      snapshot = resolveSnapshot(repositoryRoot, revision);
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "commit-unavailable",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "commit", commit: null },
      });
    }
    try {
      const observed = await inspectTree({
        gitRoot: repositoryRoot,
        outputLanguage: canonicalLanguage,
        root: repositoryRoot,
        tree: snapshot.tree,
        userHome,
        version: { type: "commit", commit: snapshot.commit },
      });
      return finishCheck(runtime, observed);
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "snapshot-inspection-failed",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "commit", commit: snapshot.commit },
      });
    }
  }

  if (staged) {
    try {
      const snapshot = indexSnapshot(repositoryRoot);
      const observed = await inspectTree({
        gitRoot: repositoryRoot,
        outputLanguage: canonicalLanguage,
        root: repositoryRoot,
        tree: snapshot.tree,
        userHome,
        version: { type: "staged" },
      });
      return finishCheck(runtime, observed);
    } catch (caught) {
      return failureReport({
        runtime,
        outputLanguage: fallbackOutputLanguage,
        problem: {
          type: "snapshot-inspection-failed",
          summary: sanitizeGitMessage(errorMessage(caught)),
        },
        root: repositoryRoot,
        version: { type: "staged" },
      });
    }
  }

  try {
    const snapshot = worktreeSnapshot(repositoryRoot);
    const observed = await inspectTree({
      gitRoot: repositoryRoot,
      outputLanguage: canonicalLanguage,
      root: repositoryRoot,
      tree: snapshot.tree,
      userHome,
      version: { type: "worktree" },
    });
    return finishCheck(runtime, observed);
  } catch (caught) {
    return failureReport({
      runtime,
      outputLanguage: fallbackOutputLanguage,
      problem: {
        type: "snapshot-inspection-failed",
        summary: sanitizeGitMessage(errorMessage(caught)),
      },
      root: repositoryRoot,
      version: { type: "worktree" },
    });
  }
}

export async function checkRepository(options: CheckRepositoryOptions = {}) {
  return checkRepositoryUseCase(options);
}
