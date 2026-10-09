/**
 * @template event-append-command
 * @when idea.storage=v2
 * 按事件类别渲染包含全部必需参数的 append 命令。
 */
import type { EventAppendCommandParameters } from "../contract.ts";

/** @pure */
export const eventAppendCommand = ({
  audience,
  confirmDecision,
  expectedDigest,
  expectedLength,
  expectedPrimary,
  ideaId,
  inputPath,
}: EventAppendCommandParameters) =>
  `silvermoon event append ${ideaId} --input ${inputPath} --expected-length ${expectedLength} --expected-digest ${expectedDigest}${expectedPrimary === null ? "" : ` --expected-primary ${expectedPrimary}`}${confirmDecision ? " --confirm-decision" : ""} --audience ${audience}`;

export default eventAppendCommand;
