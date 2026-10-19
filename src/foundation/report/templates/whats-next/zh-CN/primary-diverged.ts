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
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 diverged。`,
    nextSteps:
      `目标是得到经过验证的整合历史，保留本地 ${head} 与 primary ${primary}，且不 force-push。`,
  });

export default primaryDiverged;
