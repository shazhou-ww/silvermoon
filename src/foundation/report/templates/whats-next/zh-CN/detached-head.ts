/**
 * @template detached-head
 * @when repository.branch=null
 * 用于 repository 工作未附着到本地分支时。
 */
import type {
  DetachedHeadParameters,
  SummaryAndStep,
} from "../contract.ts";

/** @pure */
const detachedHead = ({
  expectedBranch,
  expectedRepository,
  head,
}: DetachedHeadParameters): SummaryAndStep =>
  ({
    summary: head === null
      ? "repository 当前没有本地分支。"
      : `HEAD ${head} 处于 detached 状态，没有当前分支。`,
    step: `保留当前工作，然后切换或创建 upstream 为 ${expectedRepository}#${expectedBranch} 的预期本地分支。`,
  });

export default detachedHead;
