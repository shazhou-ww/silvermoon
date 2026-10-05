import { command, repositoryProblemObservation } from "../../foundation/report/index.js";
import { localize } from "../../foundation/language/index.js";

/** @pure */
export function evaluatePrimaryRelation({
  relation,
  branch,
  head,
  primary,
  observed,
  root,
  recheckCommand,
}) {
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
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 ${relation}。`,
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
