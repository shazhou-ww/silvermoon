/**
 * @template event-history-invalid
 * @when project.version=2 repository.eventHistory=invalid
 * Used when the aligned primary event boundary fails validation.
 */
import type { EventHistoryInvalidParameters } from "../contract.ts";

/** @pure */
const eventHistoryInvalid = (
  _parameters: EventHistoryInvalidParameters,
) =>
  `The goal is valid append-only event history at the selected commit boundary while preserving both histories; repair only an explicitly authorized failure.`;

export default eventHistoryInvalid;
