import { resolve } from "node:path";

import {
  createEnvelope,
  localize,
  outcome,
} from "./dialogue.js";
import {
  fetchPrimary,
  indexSnapshot,
  resolveCommit,
  resolveHead,
  runGit,
  sanitizeGitMessage,
  worktreeSnapshot,
  withTemporaryTree,
  withTemporaryWorktree,
} from "./git.js";
import {
  incompleteObservation,
  observeSnapshot,
  repositoryProblemObservation,
} from "./observation.js";
import { projectInstructions } from "./whatsnext.js";

function targetArgument({ commit, remote, staged, worktree }) {
  if (remote) return { type: "remote" };
  if (commit !== undefined) return { type: "commit", revision: commit };
  if (staged) return { type: "staged" };
  if (worktree) return { type: "worktree" };
  return { type: "head" };
}

function recheckCommand(target) {
  if (target.type === "remote") return "silvermoon check --remote";
  if (target.type === "commit") {
    return `silvermoon check --commit ${target.revision}`;
  }
  if (target.type === "staged") return "silvermoon check --staged";
  if (target.type === "worktree") return "silvermoon check --worktree";
  return "silvermoon check";
}

function checkedInstruction(observed, target) {
  const version = observed.observation.version;
  const commit = version.commit ? ` ${version.commit}` : "";
  return localize(
    observed.language,
    `The ${target.type}${commit} snapshot satisfies the Silvermoon project contract. No repair is required.`,
    `${target.type}${commit} snapshot 符合 Silvermoon 项目契约，无需修复。`,
  );
}

function failureReport({
  intention,
  language = "en-US",
  outcomes = [],
  problem,
  root,
  version,
}) {
  return createEnvelope(
    intention,
    incompleteObservation({ problem, root, version }),
    outcomes,
    localize(
      language,
      `${problem.summary} Resolve the condition and retry ${recheckCommand(intention.args.target)}.`,
      `${problem.summary} 解决该问题后重试 ${recheckCommand(intention.args.target)}。`,
    ),
  );
}

async function inspectTree({
  baseRevision,
  gitRoot,
  historyCommit,
  root,
  tree,
  userHome,
  validateCandidate,
  version,
}) {
  return withTemporaryTree(gitRoot, tree, (contentRoot) =>
    observeSnapshot({
      baseRevision,
      contentRoot,
      gitRoot,
      historyCommit,
      root,
      snapshotTree: tree,
      userHome,
      validateCandidate,
      version,
    })
  );
}

function finishCheck(intention, observed, outcomes) {
  const instructions = observed.projectReady
    ? checkedInstruction(observed, intention.args.target)
    : projectInstructions(
      observed,
      observed.observation.root,
      observed.language,
      recheckCommand(intention.args.target),
    );
  return createEnvelope(
    intention,
    observed.observation,
    outcomes,
    instructions,
  );
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
  const outcomes = [];
  const repository = runGit(requestedRoot, ["rev-parse", "--show-toplevel"]);
  if (!repository.ok) {
    const observed = await observeSnapshot({
      root: requestedRoot,
      userHome,
      version: target.type === "commit" || target.type === "head"
        ? { type: "commit", commit: null }
        : target.type === "remote"
          ? { type: "remote", commit: null }
          : { type: target.type },
    });
    return finishCheck(intention, observed, outcomes);
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
        (contentRoot, tree) => observeSnapshot({
          contentRoot,
          gitRoot: repositoryRoot,
          historyCommit: head,
          root: repositoryRoot,
          snapshotTree: tree,
          userHome,
          version: { type: "commit", commit: head },
        }),
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
    if (!bootstrap.projectReady) {
      const remoteObservation = {
        ...bootstrap.observation,
        version: { type: "remote", commit: null },
      };
      return createEnvelope(
        intention,
        remoteObservation,
        outcomes,
        projectInstructions(
          bootstrap,
          repositoryRoot,
          bootstrap.language,
          recheckCommand(target),
        ),
      );
    }

    let primary;
    try {
      primary = fetchPrimary(repositoryRoot, bootstrap.config);
      outcomes.push(outcome(
        "fetch-primary",
        "success",
        localize(
          bootstrap.language,
          `Fetched ${bootstrap.config.primaryRepository}#${bootstrap.config.primaryBranch} at ${primary} without moving the worktree, index, branch, or named refs.`,
          `已 fetch ${bootstrap.config.primaryRepository}#${bootstrap.config.primaryBranch} 的 ${primary}，未移动 worktree、index、branch 或 named refs。`,
        ),
      ));
    } catch (caught) {
      const summary = sanitizeGitMessage(caught.message);
      outcomes.push(outcome(
        "fetch-primary",
        "failure",
        localize(
          bootstrap.language,
          `Could not fetch configured primary: ${summary}`,
          `无法 fetch configured primary：${summary}`,
        ),
      ));
      return createEnvelope(
        intention,
        repositoryProblemObservation(
          {
            ...bootstrap.observation,
            version: { type: "remote", commit: null },
          },
          [{ type: "primary-fetch-failed", summary }],
        ),
        outcomes,
        localize(
          bootstrap.language,
          `Check network access, authorization, repository URL, and primary branch, then retry ${recheckCommand(target)}.`,
          `检查网络、授权、repository URL 和 primary branch，然后重试 ${recheckCommand(target)}。`,
        ),
      );
    }
    try {
      const observed = await withTemporaryWorktree(
        repositoryRoot,
        primary,
        (contentRoot, tree) => observeSnapshot({
          contentRoot,
          gitRoot: repositoryRoot,
          historyCommit: primary,
          root: repositoryRoot,
          snapshotTree: tree,
          userHome,
          version: { type: "remote", commit: primary },
        }),
      );
      return finishCheck(intention, observed, outcomes);
    } catch (caught) {
      return failureReport({
        intention,
        language: bootstrap.language,
        outcomes,
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
      const parent = runGit(repositoryRoot, ["rev-parse", `${resolvedCommit}^1`]);
      const observed = await withTemporaryWorktree(
        repositoryRoot,
        resolvedCommit,
        (contentRoot, tree) => observeSnapshot({
          baseRevision: parent.ok ? parent.stdout : null,
          contentRoot,
          gitRoot: repositoryRoot,
          root: repositoryRoot,
          snapshotTree: tree,
          userHome,
          validateCandidate: true,
          version: { type: "commit", commit: resolvedCommit },
        }),
      );
      return finishCheck(intention, observed, outcomes);
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
        baseRevision: resolveHead(repositoryRoot),
        gitRoot: repositoryRoot,
        root: repositoryRoot,
        tree: snapshot.tree,
        userHome,
        validateCandidate: true,
        version: { type: "staged" },
      });
      return finishCheck(intention, observed, outcomes);
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
      baseRevision: resolveHead(repositoryRoot),
      gitRoot: repositoryRoot,
      root: repositoryRoot,
      tree: snapshot.tree,
      userHome,
      validateCandidate: true,
      version: { type: "worktree" },
    });
    return finishCheck(intention, observed, outcomes);
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
