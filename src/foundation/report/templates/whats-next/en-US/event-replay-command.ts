/**
 * @template event-replay-command
 * @when idea.storage=v2
 * Renders the complete replay command used to observe the event cursor.
 */
import type { EventReplayCommandParameters } from "../contract.ts";

/** @pure */
export const eventReplayCommand = ({
  audience,
  ideaId,
}: EventReplayCommandParameters) =>
  `silvermoon event replay ${ideaId} --audience ${audience}`;

export default eventReplayCommand;
