/**
 * @template event-accept-guidance
 * @when idea.submission=current-phase-submitted and idea.control=upstream
 * 指导 upstream 所有者通过事件记录明确验收。
 */
import type { EventAcceptGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventAcceptGuidance = ({
  action,
  appendCommand,
  revisionField,
  revisionKind,
  revisionReference,
  submitAction,
}: EventAcceptGuidanceParameters) =>
  `当前${revisionKind === "Idea" ? "构想" : revisionKind === "implementation" ? "实现" : "部署"} revision 已由 ${submitAction} 记录，控制权在 upstream。呈现 response.review，并请求 revision reference ${revisionReference} 对应的明确 ${action} 决定。获得该明确决定后，使用 ${appendCommand} 和 response.review 中完整的 ${revisionField} 记录 ${action}；无需 replay cursor 或 expected length。`;

export default eventAcceptGuidance;
