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
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 unknown。`,
    nextSteps:
      `从 remote ${remote} 补全 shallow history，直到可以比较 ${head} 和 ${primary}，然后再运行 ${recheckCommand}。`,
  });

export default primaryHistoryIncomplete;
