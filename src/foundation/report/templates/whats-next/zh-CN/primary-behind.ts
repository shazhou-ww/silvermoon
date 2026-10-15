/**
 * @template primary-behind
 * @when repository.primaryRelation=behind
 * 用于本地 HEAD 可以 fast-forward 到已观察 primary 时。
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryBehind = ({
  branch,
  head,
  primary,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 behind。`,
    nextSteps:
      `目标是让分支 ${branch} 到达已观察 primary ${primary}，且不改写历史。`,
  });

export default primaryBehind;
