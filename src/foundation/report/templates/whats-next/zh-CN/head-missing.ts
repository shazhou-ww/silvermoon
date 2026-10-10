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
    nextSteps: "确认预期分支和应纳入版本控制的文件后，创建初始 commit。",
  });

export default headMissing;
