/**
 * @template event-replay-command
 * @when idea.storage=v2
 * 渲染用于观察事件 cursor 的完整 replay 命令。
 */
import type { EventReplayCommandParameters } from "../contract.ts";

/** @pure */
export const eventReplayCommand = ({
  audience,
  ideaId,
}: EventReplayCommandParameters) =>
  `silvermoon event replay ${ideaId} --audience ${audience}`;

export default eventReplayCommand;
