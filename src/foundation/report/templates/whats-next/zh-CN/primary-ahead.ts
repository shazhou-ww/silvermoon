/**
 * @template primary-ahead
 * @when repository.primaryRelation=ahead
 * 用于已验证本地历史必须普通 push 到 primary 时。
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryAhead = ({
  head,
  primary,
  primaryBranch,
  remote,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 ahead。`,
    nextSteps:
      `目标是通过普通非 force 同步，让已验证的本地 HEAD ${head} 可从 ${remote}/${primaryBranch} 到达，同时保留并发 primary 历史。`,
  });

export default primaryAhead;
