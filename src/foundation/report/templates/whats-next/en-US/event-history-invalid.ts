/**
 * @template event-history-invalid
 * @when project.version=2 repository.eventHistory=invalid
 * Used when the aligned primary event boundary fails validation.
 */
import type { EventHistoryInvalidParameters } from "../contract.ts";

/** @pure */
export default function eventHistoryInvalid({
  recheckCommand,
}: EventHistoryInvalidParameters) {
  return `Preserve both histories. Review the selected commit's event boundary and repair only an authorized failure, then retry ${recheckCommand} --audience agent.`;
}
