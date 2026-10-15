/**
 * @template primary-history-incomplete
 * @when repository.primaryRelation=unknown
 * 用于 shallow history 阻止可靠 primary 比较时。
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryHistoryIncomplete = ({
  head,
  primary,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 unknown。`,
    nextSteps:
      `目标是让本地历史足以可靠比较 ${head} 与已观察 primary ${primary}。`,
  });

export default primaryHistoryIncomplete;
