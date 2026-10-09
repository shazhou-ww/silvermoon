/**
 * @template primary-ahead
 * @when repository.primaryRelation=ahead
 * 用于已验证本地历史必须普通 push 到 primary 时。
 */
import type {
  PrimaryRelationParameters,
  SummaryAndInstructions,
} from "../contract.ts";

/** @pure */
const primaryAhead = ({
  head,
  primary,
  primaryBranch,
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndInstructions =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 ahead。`,
    instructions: [
      `验证本地 commit ${head}，确认 remote tip 仍为 ${primary}，`,
      `再普通 push 到 ${remote}/${primaryBranch}，不要 force。`,
      `push 后重新运行 ${recheckCommand}。`,
    ].join(""),
  });

export default primaryAhead;
