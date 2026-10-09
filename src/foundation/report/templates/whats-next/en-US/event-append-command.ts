/**
 * @template event-append-command
 * @when idea.storage=v2
 * Renders an append command with every parameter required by its event class.
 */
import type { EventAppendCommandParameters } from "../contract.ts";

/** @pure */
export const eventAppendCommand = ({
  audience,
  confirmDecision,
  expectedDigest,
  expectedPrimary,
  ideaId,
  inputPath,
}: EventAppendCommandParameters) =>
  `silvermoon event append ${ideaId} --input ${inputPath} --expected-digest ${expectedDigest}${expectedPrimary === null ? "" : ` --expected-primary ${expectedPrimary}`}${confirmDecision ? " --confirm-decision" : ""} --audience ${audience}`;

export default eventAppendCommand;
