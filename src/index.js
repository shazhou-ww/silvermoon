import { resolve } from "node:path";

import {
  diagnosticProblem,
} from "./dialogue.js";
import { loadConfig } from "./config.js";
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
  intention,
  problem,
  root,
  version,
}) {
  return {
    intention,
    observation: unavailableObservation({ problem, root, version }),
  };
}

async function inspectTree({
  gitRoot,
  root,
  tree,
  userHome,
  version,
}) {
  return withTemporaryTree(gitRoot, tree, (contentRoot) =>
    observeSnapshot({
      contentRoot,
      gitRoot,
      root,
      projectOnly: true,
      snapshotTree: tree,
      userHome,
      version,
    })
  );
}

function finishCheck(intention, observed) {
  return { intention, observation: observed.observation };
}

export async function checkRepository({
  commit,
  remote = false,
  root = process.cwd(),
  staged = false,
  userHome,
  worktree = false,
} = {}) {
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
  const intention = { command: "check", args: { target } };
  const repository = runGit(requestedRoot, ["rev-parse", "--show-toplevel"]);
  if (!repository.ok) {
    const observed = await observeSnapshot({
      projectOnly: true,
      root: requestedRoot,
      userHome,
      version: target.type === "commit" || target.type === "head"
        ? { type: "commit", commit: null }
        : target.type === "remote"
          ? { type: "remote", commit: null }
          : { type: target.type },
    });
    return finishCheck(intention, observed);
  }
  const repositoryRoot = resolve(repository.stdout);

  if (remote) {
    let head;
    try {
      head = resolveCommit(repositoryRoot, "HEAD");
    } catch (caught) {
      return failureReport({
        intention,
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
        intention,
        problem: {
          type: "snapshot-inspection-failed",
          summary: sanitizeGitMessage(caught.message),
        },
        root: repositoryRoot,
        version: { type: "remote", commit: null },
      });
    }
    if (!bootstrap.config) {
      return {
        intention,
        observation: {
          state: "project-setup-required",
          observedThrough: "version",
          root: repositoryRoot,
          version: { type: "remote", commit: null },
          problems: bootstrap.diagnostics.map((diagnostic) =>
            diagnosticProblem(diagnostic)
          ),
        },
      };
    }

    let primary;
    try {
      primary = fetchPrimary(repositoryRoot, bootstrap.config);
    } catch (caught) {
      const summary = sanitizeGitMessage(caught.message);
      return failureReport({
        intention,
        root: repositoryRoot,
        version: { type: "remote", commit: null },
        problem: { type: "primary-fetch-failed", summary },
      });
    }
    try {
      const observed = await withTemporaryWorktree(
        repositoryRoot,
        primary,
        (contentRoot, tree) => observeSnapshot({
          contentRoot,
          gitRoot: repositoryRoot,
          root: repositoryRoot,
          projectOnly: true,
          snapshotTree: tree,
          userHome,
          version: { type: "remote", commit: primary },
        }),
      );
      return finishCheck(intention, observed);
    } catch (caught) {
      return failureReport({
        intention,
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
        intention,
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
          root: repositoryRoot,
          projectOnly: true,
          snapshotTree: tree,
          userHome,
          version: { type: "commit", commit: resolvedCommit },
        }),
      );
      return finishCheck(intention, observed);
    } catch (caught) {
      return failureReport({
        intention,
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
        root: repositoryRoot,
        tree: snapshot.tree,
        userHome,
        version: { type: "staged" },
      });
      return finishCheck(intention, observed);
    } catch (caught) {
      return failureReport({
        intention,
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
      root: repositoryRoot,
      tree: snapshot.tree,
      userHome,
      version: { type: "worktree" },
    });
    return finishCheck(intention, observed);
  } catch (caught) {
    return failureReport({
      intention,
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
  deriveIdeaState,
  isValidUlid,
  parseIdeaStatus,
  serializeIdeaStatus,
  validateIdeaStatus,
} from "./ideas.js";
export { createIdea, generateUlid } from "./create-idea.js";
export {
  inspectAdoption,
  SILVERMOON_VERSION,
} from "./adoption.js";
export { whatsNext } from "./whatsnext.js";
