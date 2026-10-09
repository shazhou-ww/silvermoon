/**
 * @template repository-recheck
 * @when repository.ready=false
 * 用于列出全部适用的本地 repository 恢复步骤之后。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function repositoryRecheck({
  recheckCommand,
}: RecheckParameters) {
  return `完成全部适用步骤后，再运行 ${recheckCommand}。`;
}
