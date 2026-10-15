/**
 * @template detached-head
 * @when repository.branch=null
 * 用于 repository 工作未附着到本地分支时。
 */
import type {
  DetachedHeadParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const detachedHead = ({
  expectedBranch,
  expectedRepository,
  head,
}: DetachedHeadParameters): SummaryAndNextSteps =>
  ({
    summary: head === null
      ? "repository 当前没有本地分支。"
      : `HEAD ${head} 处于 detached 状态，没有当前分支。`,
    nextSteps: [
      `目标是在不丢失当前工作的前提下，把工作附着到 upstream 为 `,
      `\`${expectedRepository}#${expectedBranch}\` 的本地分支。`,
    ].join(""),
  });

export default detachedHead;
