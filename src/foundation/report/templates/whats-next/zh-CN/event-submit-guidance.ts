/**
 * @template event-submit-guidance
 * @when idea.submission=current-phase-unsubmitted|stale
 * 指导 downstream 所有者记录当前阶段的提交事件。
 */
import type { EventSubmitGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventSubmitGuidance = ({
  acceptanceAction,
  action,
  appendCommand,
  controlOwner,
  evidence,
  revisionKind,
  submissionState,
}: EventSubmitGuidanceParameters) =>
  `当前${revisionKind === "Idea" ? "构想" : revisionKind === "implementation" ? "实现" : "部署"} revision 为 ${submissionState ?? "unsubmitted"}，控制权在 ${controlOwner ?? "unknown"}。${evidence === "Idea candidate" ? "构想候选" : evidence === "implementation evidence" ? "实现证据" : "外部证据"}就绪后先同步到 primary，再用 ${appendCommand} 为准确的当前 revision 记录 ${action}；无需 replay cursor 或 expected length。在该 Submit 对当前 revision 生效前不要请求 ${acceptanceAction}。不要直接编辑 events.jsonl。`;

export default eventSubmitGuidance;
