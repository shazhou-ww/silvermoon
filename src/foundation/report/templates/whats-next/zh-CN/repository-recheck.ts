/**
 * @template repository-recheck
 * @when repository.ready=false
 * 用于列出全部适用的本地 repository 恢复步骤之后。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const repositoryRecheck = (
  _parameters: RecheckParameters,
) =>
  "目标是让 repository 满足全部已报告的 readiness 条件，同时保留未知工作。";

export default repositoryRecheck;
