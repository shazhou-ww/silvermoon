/**
 * @template primary-diverged
 * @when repository.primaryRelation=diverged
 * 用于必须保留并整合本地和 primary 两边历史时。
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryDiverged = ({
  head,
  primary,
  recheckCommand,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 diverged。`,
    nextSteps:
      `保留本地 ${head} 与 remote ${primary}，在不 force-push 的前提下整合两边历史，解决并验证结果，然后再运行 ${recheckCommand}。`,
  });

export default primaryDiverged;
