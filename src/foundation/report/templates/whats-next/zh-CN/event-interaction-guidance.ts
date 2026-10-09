/**
 * @template event-interaction-guidance
 * @when idea.submission=current-phase-submitted and idea.control!=upstream
 * 指导不改变提交事实的阶段内 ping/pong 交流。
 */
import type { EventInteractionGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventInteractionGuidance = ({
  action,
  appendCommand,
  controlOwner,
  replayCommand,
  revisionKind,
  submitAction,
}: EventInteractionGuidanceParameters) =>
  `当前${revisionKind === "Idea" ? "构想" : revisionKind === "implementation" ? "实现" : "部署"} revision 仍由 ${submitAction} 记录，但控制权在 ${controlOwner ?? "unknown"}。只继续把控制权交回 downstream 的阶段内回复或工作；用 ${replayCommand} 获取准确 cursor，再使用 ${appendCommand} 进行该 ping/pong 交流，在控制权重新回到 upstream 前不要请求 ${action}。`;

export default eventInteractionGuidance;
