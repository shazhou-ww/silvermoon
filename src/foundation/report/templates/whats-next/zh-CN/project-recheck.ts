/**
 * @template project-recheck
 * @when project.ready=false
 * 用于报告阻塞 what's next 的项目整备问题之后。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function projectRecheck({
  recheckCommand,
}: RecheckParameters) {
  return `完成适用步骤后，再运行 ${recheckCommand}。`;
}
