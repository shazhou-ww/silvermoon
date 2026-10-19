/**
 * @template head-missing
 * @when repository.head=null
 * 用于 repository 尚无初始 commit 时。
 */
import type { SummaryAndNextSteps } from "../contract.ts";

/** @pure */
const headMissing = (): SummaryAndNextSteps =>
  ({
    summary: "repository 的 HEAD 尚无 commit。",
    nextSteps: "目标是让 repository HEAD 存在包含预期初始项目内容的 commit。",
  });

export default headMissing;
