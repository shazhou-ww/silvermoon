/**
 * @template event-history-invalid
 * @when project.version=2 repository.eventHistory=invalid
 * Used when the aligned primary event boundary fails validation.
 */
import type { EventHistoryInvalidParameters } from "../contract.ts";

/** @pure */
const eventHistoryInvalid = ({
  recheckCommand,
}: EventHistoryInvalidParameters) =>
  [
    `Preserve both histories.`,
    `Review the selected commit's event boundary and repair only an authorized failure,`,
    `then retry ${recheckCommand}.`,
  ].join(" ");

export default eventHistoryInvalid;
