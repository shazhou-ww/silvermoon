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
  mergeCommand,
  primary,
  recheckCommand,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `本地 HEAD 为 ${head}；观测到的 primary 是 ${primary}；两者关系为 behind。`,
    nextSteps: [
      `使用 ${mergeCommand} 将分支 ${branch}`,
      ` fast-forward 到已观察 primary ${primary}，`,
      `不要改写历史，然后再运行 ${recheckCommand}。`,
    ].join(""),
  });

export default primaryBehind;
