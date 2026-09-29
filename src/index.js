import { resolve } from "node:path";

import {
  diagnosticProblem,
} from "./dialogue.js";
import { loadConfig } from "./config.js";
import { createCommandRun } from "./domain.js";
import {
  fetchPrimary,
  indexSnapshot,
  resolveCommit,
  runGit,
  sanitizeGitMessage,
  worktreeSnapshot,
  withTemporaryTree,
  withTemporaryWorktree,
} from "./git.js";
import {
  canonicalizeOutputLanguage,
  DEFAULT_LANGUAGE,
} from "./language.js";
import {
  observeSnapshot,
  unavailableObservation,
} from "./observation.js";

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
  return withTemporaryTree(gitRoot, tree, (contentRoot) =>
    observeSnapshot({
      contentRoot,
      gitRoot,
      outputLanguage,
      root,
      projectOnly: true,
      snapshotTree: tree,
      userHome,
      version,
    })
  );
}

function finishCheck(runtime, observed) {
  return runtime.complete(
    observed.observation,
    {},
    { factType: "validation.completed" },
  );
}

export async function checkRepository({
  commit,
  language,
  remote = false,
  root = process.cwd(),
  staged = false,
  userHome,
  worktree = false,
} = {}) {
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
      head = resolveCommit(repositoryRoot, "HEAD");
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
      bootstrap = await withTemporaryWorktree(
        repositoryRoot,
        head,
        (contentRoot) => loadConfig({ root: contentRoot }),
      );
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
      const observed = await withTemporaryWorktree(
        repositoryRoot,
        primary,
        (contentRoot, tree) => observeSnapshot({
          contentRoot,
          gitRoot: repositoryRoot,
          outputLanguage: canonicalLanguage,
          root: repositoryRoot,
          projectOnly: true,
          snapshotTree: tree,
          userHome,
          version: { type: "remote", commit: primary },
        }),
      );
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
    let resolvedCommit;
    try {
      resolvedCommit = resolveCommit(repositoryRoot, revision);
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
      const observed = await withTemporaryWorktree(
        repositoryRoot,
        resolvedCommit,
        (contentRoot, tree) => observeSnapshot({
          contentRoot,
          gitRoot: repositoryRoot,
          outputLanguage: canonicalLanguage,
          root: repositoryRoot,
          projectOnly: true,
          snapshotTree: tree,
          userHome,
          version: { type: "commit", commit: resolvedCommit },
        }),
      );
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
        version: { type: "commit", commit: resolvedCommit },
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

export {
  ACTIVE_IDEA_STATES,
  deriveIdeaState,
  IDEA_STATES,
  isValidUlid,
  parseIdeaStatus,
  serializeIdeaStatus,
  validateIdeaStatus,
} from "./ideas.js";
export {
  extractIdeaTitle,
  ideaCreatedAt,
  ideaInventoryItem,
  normalizeIdeaQuery,
  queryIdeaInventory,
} from "./idea-query.js";
export { listIdeas } from "./list-ideas.js";
export { createIdea, generateUlid } from "./create-idea.js";
export {
  inspectAdoption,
  SILVERMOON_VERSION,
} from "./adoption.js";
export {
  CommandRun,
  DOMAIN_MESSAGE_SCHEMA_VERSION,
  DomainInvariantError,
  driveCommand,
  initialInternalObservation,
  projectActions,
  projectIntention,
  projectPublicObservation,
  projectReport,
  reduceObservation,
  replayObservation,
} from "./domain.js";
export {
  renderResponse,
  respond,
} from "./response.js";
export { TRACE_SCHEMA_VERSION } from "./trace.js";
export { whatsNext } from "./whatsnext.js";
