import { resolve } from "node:path";

import { REPOSITORY_SKILL_PATH } from "../project/index.js";
import { createCommandRun } from "../command/index.js";
import { loadConfigSnapshot } from "../project/index.js";
import {
  diagnosticProblem,
} from "../response/index.js";
import { inspectEventHistory } from "../events/index.js";
import { createGitSnapshotFileSystem } from "../repository/index.js";
import {
  fetchPrimary,
  indexSnapshot,
  resolveSnapshot,
  runGit,
  sanitizeGitMessage,
  worktreeSnapshot,
} from "../repository/index.js";
import {
  canonicalizeOutputLanguage,
  DEFAULT_LANGUAGE,
} from "../project/rules/index.js";
import {
  CONFIG_PATH,
  GUIDANCE_ROOT,
  IDEAS_ROOT,
} from "../project/rules/index.js";
import {
  observeSnapshot,
  unavailableObservation,
} from "./observation/index.js";

function preloadCheckBlob({ name }) {
  return (
    name === CONFIG_PATH
    || name === "package.json"
    || name.startsWith(`${REPOSITORY_SKILL_PATH}/`)
    || name.startsWith(`${GUIDANCE_ROOT}/`)
    || (
      name.startsWith(`${IDEAS_ROOT}/`)
      && (name.endsWith("/status.yaml") || name.endsWith("/events.jsonl") || /\/events\/[0-9]{16}\.jsonl$/.test(name))
    )
  );
}

function targetArgument({ commit, remote, staged, worktree }) {
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
}) {
  const filesystem = createGitSnapshotFileSystem({
    gitRoot,
    preload: preloadCheckBlob,
    root,
    tree,
  });
  const observed = await observeSnapshot({
    contentRoot: root,
    filesystem,
    gitRoot,
    outputLanguage,
    root,
    projectOnly: true,
    snapshotTree: tree,
    userHome,
    version,
  });
  const eventHistoryConfig = observed.config?.version === 2 ? observed.config : null;
  if (observed.config?.version === 1) {
    const currentCommit = version?.commit ?? "HEAD";
    const current = runGit(gitRoot, ["cat-file", "-p", currentCommit]);
    if (!current.ok) throw new Error("Cannot inspect the candidate's first parent.");
    const parent = /^parent ([0-9a-f]+)$/m.exec(current.stdout.split("\n\n")[0])?.[1];
    const base = version?.type === "worktree" || version?.type === "staged"
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
      observed.observation.eventHistory = await inspectEventHistory({
        root: gitRoot, tree, config: eventHistoryConfig,
        commit: version?.commit ?? undefined,
        primary: version?.type === "remote" ? version.commit : undefined,
      });
    } catch (caught) {
      observed.observation.eventHistory = {
        valid: false, error: caught.message, candidateSnapshotValid: observed.projectReady,
        ...(caught.eventBaseline ? { baseline: caught.eventBaseline } : {}),
        ...(caught.eventStage ? { unavailableStage: caught.eventStage } : {}),
        ...(caught.eventCheck ? { result: caught.eventCheck } : {}),
      };
      observed.observation.problems.push({
        type: "idea.events.history-invalid", summary: caught.message,
      });
      observed.observation.state = "check-unavailable";
    }
  }
  return observed;
}

function finishCheck(runtime, observed) {
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
} = {}, ports = CHECKREPOSITORY_PORTS) {
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
    error.exitCode = 2;
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
          summary: sanitizeGitMessage(caught.message),
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
          summary: sanitizeGitMessage(caught.message),
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
          diagnosticProblem(diagnostic, fallbackOutputLanguage)
        ),
      });
    }

    const fetched = await runtime.performAction(
      {
        type: "fetch-primary",
        repository: bootstrap.config.primaryRepository,
        branch: bootstrap.config.primaryBranch,
      },
      () => ({
        commit: fetchPrimary(repositoryRoot, bootstrap.config),
      }),
      (caught) => ({
        problem: {
          type: "primary-fetch-failed",
          summary: sanitizeGitMessage(caught.message),
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
          summary: sanitizeGitMessage(caught.message),
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
          summary: sanitizeGitMessage(caught.message),
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
          summary: sanitizeGitMessage(caught.message),
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
          summary: sanitizeGitMessage(caught.message),
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
        summary: sanitizeGitMessage(caught.message),
      },
      root: repositoryRoot,
      version: { type: "worktree" },
    });
  }
}

export async function checkRepository(options = {}) {
  return checkRepositoryUseCase(options);
}
