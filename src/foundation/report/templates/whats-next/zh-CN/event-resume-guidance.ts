/**
 * @template event-resume-guidance
 * @when idea.state=abandoned|completed and idea.storage=v2
 * 指导在明确授权后记录 resume，避免与 lifecycle 文案混杂。
 */
import type { EventResumeGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventResumeGuidance = ({
  appendCommand,
  replayCommand,
}: EventResumeGuidanceParameters) =>
  `只有获得明确的人类决定后才能恢复：先用 ${replayCommand} 获取准确 cursor，再使用 ${appendCommand} 记录 resume。`;

export default eventResumeGuidance;
