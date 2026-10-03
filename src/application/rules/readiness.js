import {
  command,
  localRepositoryInstructions,
  summarizeWorktreeChanges, worktreeInstructionSteps
} from "../../response/index.js";
import { localize } from "../../project/rules/index.js";
import { repositoryProblemObservation } from "../../response/index.js";

/** @pure */
export function evaluateLocalReadiness({ repository, observed, root, recheckCommand }) {
  const language = observed.outputLanguage;
  const { branch, changes, head } = repository;

  const dirty =
    changes.conflicted.length > 0
    || changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  const localProblems = [];
  const localSteps = [];
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
      observation: repositoryProblemObservation(
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

  return { branch, changes, head, observation: observed.observation, ready: true };
}

/** @pure */
export function evaluatePrimaryRelation({ relation, branch, head, primary, observed, root, recheckCommand }) {
  const language = observed.outputLanguage;
  if (relation === "aligned") {
    return { branch, head, observation: observed.observation, primary, ready: true };
  }
  const problem = {
    type: relation === "unknown"
      ? "primary-history-incomplete"
      : `primary-${relation}`,
    summary: localize(
      language,
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is ${relation}.`,
      `本地 HEAD 为 ${head}；观测到的 primary 为 ${primary}；两者关系为 ${relation}。`,
    ),
  };
  let instructions;
  if (relation === "unknown") {
    instructions = localize(
      language,
      `Deepen the shallow history from remote ${branch.remote} until ${head} and ${primary} can be compared, then run ${command(root, recheckCommand)} again.`,
      `从 remote ${branch.remote} 补全 shallow history，直到可以比较 ${head} 和 ${primary}，然后再运行 ${command(root, recheckCommand)}。`,
    );
  } else if (relation === "behind") {
    instructions = localize(
      language,
      `Fast-forward branch ${branch.branch} to observed primary ${primary} with ${command(root, `git -C "<root>" merge --ff-only ${primary}`)} without rewriting history, then run ${command(root, recheckCommand)} again.`,
      `使用 ${command(root, `git -C "<root>" merge --ff-only ${primary}`)} 将分支 ${branch.branch} fast-forward 到已观察 primary ${primary}，不要改写历史，然后再运行 ${command(root, recheckCommand)}。`,
    );
  } else if (relation === "ahead") {
    instructions = localize(
      language,
      `Validate local commit ${head}, confirm the remote tip is still ${primary}, then push normally to ${branch.remote}/${observed.config.primaryBranch} without force. Re-run ${command(root, recheckCommand)} after the push.`,
      `验证本地 commit ${head}，确认 remote tip 仍为 ${primary}，再普通 push 到 ${branch.remote}/${observed.config.primaryBranch}，不要 force。push 后重新运行 ${command(root, recheckCommand)}。`,
    );
  } else {
    instructions = localize(
      language,
      `Preserve local ${head} and remote ${primary}, integrate both histories without force-pushing, resolve and validate the result, then run ${command(root, recheckCommand)} again.`,
      `保留本地 ${head} 与 remote ${primary}，在不 force-push 的前提下整合两边历史，解决并验证结果，然后再运行 ${command(root, recheckCommand)}。`,
    );
  }
  return {
    branch,
    head,
    observation: repositoryProblemObservation(observed.observation, [problem]),
    primary,
    instructions,
    ready: false,
  };
}
