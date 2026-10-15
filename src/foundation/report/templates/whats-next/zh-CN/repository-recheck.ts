/**
 * @template repository-recheck
 * @when repository.ready=false
 * 用于列出全部适用的本地 repository 恢复步骤之后。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const repositoryRecheck = ({
  recheckCommand,
}: RecheckParameters) =>
  `repository 达到目标状态后，可用 ${recheckCommand} 验证阻塞是否已经消除。`;

export default repositoryRecheck;
