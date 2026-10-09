/**
 * @template project-recheck
 * @when project.ready=false
 * Used after reporting project setup findings that block what's next.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function projectRecheck({
  recheckCommand,
}: RecheckParameters) {
  return `After completing the applicable steps, run ${recheckCommand} again.`;
}
