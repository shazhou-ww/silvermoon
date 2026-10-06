import { command, localRepositoryInstructions, summarizeWorktreeChanges, worktreeInstructionSteps } from "../../foundation/report/index.ts";
import { localize } from "../../foundation/language/index.ts";
import type {
  ReadyObservation,
  RepositoryReadiness,
  RepositoryState,
} from "./business-types.ts";
import { repositoryProblem } from "./business-types.ts";

/** @pure */
export function evaluateLocalReadiness({
  repository,
  observed,
  root,
  recheckCommand,
}: {
  repository: RepositoryState;
  observed: ReadyObservation;
  root: string;
  recheckCommand: string;
}): RepositoryReadiness {
  const language = observed.outputLanguage;
  const { branch, changes, head } = repository;

  const dirty =
    changes.conflicted.length > 0
    || changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  const localProblems: { type: string; summary: string }[] = [];
  const localSteps: string[] = [];
  if (dirty) {
    if (changes.conflicted.length > 0) {
      localProblems.push({
        type: "worktree-conflicts",
        summary: localize(
          language,
          `${changes.conflicted.length} conflicted path(s); ${summarizeWorktreeChanges({
            conflicted: changes.conflicted,
            staged: [],
            unstaged: [],
            untracked: [],
          }, language)}`,
          `${changes.conflicted.length} 个冲突路径；${summarizeWorktreeChanges({
            conflicted: changes.conflicted,
            staged: [],
            unstaged: [],
            untracked: [],
          }, language)}`,
        ),
      });
    }
    if (
      changes.staged.length > 0
      || changes.unstaged.length > 0
      || changes.untracked.length > 0
    ) {
      localProblems.push({
        type: "worktree-changes",
        summary: summarizeWorktreeChanges({
          conflicted: [],
          staged: changes.staged,
          unstaged: changes.unstaged,
          untracked: changes.untracked,
        }, language),
      });
    }
    localSteps.push(...worktreeInstructionSteps(changes, language));
  }

  if (head === null) {
    localProblems.push({
      type: "head-missing",
      summary: localize(
        language,
        "The repository has no commit at HEAD.",
        "repository 的 HEAD 尚无 commit。",
      ),
    });
    localSteps.push(localize(
      language,
      "After resolving conflicts and deciding which local changes belong, create the initial commit on the intended branch.",
      "解决冲突并确认应保留的本地修改后，在预期分支创建初始 commit。",
    ));
  }

  if (branch.branch === null) {
    localProblems.push({
      type: "detached-head",
      summary: localize(
        language,
        head === null
          ? "The repository has no current local branch."
          : `HEAD ${head} is detached and has no current branch.`,
        head === null
          ? "repository 当前没有本地分支。"
          : `HEAD ${head} 处于 detached 状态，没有当前分支。`,
      ),
    });
    localSteps.push(localize(
      language,
      `Preserve current work, then switch to or create the intended local branch whose upstream is ${observed.config.primaryRepository}#${observed.config.primaryBranch}.`,
      `保留当前工作，然后切换或创建 upstream 为 ${observed.config.primaryRepository}#${observed.config.primaryBranch} 的预期本地分支。`,
    ));
  } else {
    if (
      branch.repository !== observed.config.primaryRepository
      || branch.upstreamBranch !== observed.config.primaryBranch
    ) {
      const actual = branch.remote === null
        ? localize(language, "none", "无")
        : `${branch.repository ?? branch.remote}#${branch.upstreamBranch ?? localize(language, "unknown", "未知")}`;
      localProblems.push({
        type: "primary-upstream-mismatch",
        summary: localize(
          language,
          `Branch ${branch.branch} has upstream ${actual}; expected ${observed.config.primaryRepository}#${observed.config.primaryBranch}.`,
          `分支 ${branch.branch} 的 upstream 是 ${actual}；预期为 ${observed.config.primaryRepository}#${observed.config.primaryBranch}。`,
        ),
      });
      localSteps.push(localize(
        language,
        `Configure a named remote for ${observed.config.primaryRepository}, then set branch ${branch.branch} to track that remote's ${observed.config.primaryBranch} branch. Verify with ${command(root, 'git -C "<root>" rev-parse --abbrev-ref --symbolic-full-name \'@{upstream}\'')}.`,
        `为 ${observed.config.primaryRepository} 配置 named remote，再将分支 ${branch.branch} 的 upstream 设为该 remote 的 ${observed.config.primaryBranch}。使用 ${command(root, 'git -C "<root>" rev-parse --abbrev-ref --symbolic-full-name \'@{upstream}\'')} 验证。`,
      ));
    }
  }

  if (localProblems.length > 0) {
    return {
      branch,
      changes,
      head,
      observation: repositoryProblem(
        observed.observation,
        localProblems,
      ),
      instructions: localRepositoryInstructions(
        root,
        localSteps,
        language,
        recheckCommand,
      ),
      ready: false,
    };
  }

  if (head === null) {
    throw new Error("Ready repository unexpectedly omitted HEAD.");
  }
  return { branch, changes, head, observation: observed.observation, ready: true };
}
