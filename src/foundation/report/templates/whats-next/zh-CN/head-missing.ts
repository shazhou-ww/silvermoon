/**
 * @template head-missing
 * @when repository.head=null
 * 用于 repository 尚无初始 commit 时。
 */
import type { SummaryAndStep } from "../contract.ts";

/** @pure */
const headMissing = (): SummaryAndStep =>
  ({
    summary: "repository 的 HEAD 尚无 commit。",
    step: "解决冲突并确认应保留的本地修改后，在预期分支创建初始 commit。",
  });

export default headMissing;
