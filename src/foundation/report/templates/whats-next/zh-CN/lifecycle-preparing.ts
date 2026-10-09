/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * 用于 acceptIdeal 前继续推进构想契约时。
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
export default function lifecyclePreparing({
  action,
  controlOwner,
  documentPath,
  eventDigest,
  eventBacked,
  ideaId,
  ledgerPath,
  name,
  primaryCommit,
  revisionReference,
  statusPath,
  submissionState,
  submitAction,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    if (submissionState === "submitted") {
      return controlOwner === "upstream"
        ? `当前构想 revision 已由 ${submitAction} 记录，控制权在 upstream。呈现 response.review，并请求 revision reference ${revisionReference} 对应的明确 ${action} 决定。只有使用 response.review 中的完整 revision，并通过 silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent 才能记录验收；无需 replay cursor。`
        : `当前构想 revision 仍由 ${submitAction} 记录，但控制权在 ${controlOwner ?? "unknown"}。只继续把控制权交回 downstream 的阶段内回复或工作；该交流使用 ping/pong，在控制权重新回到 upstream 前不要请求 ${action}。`;
    }
    return `在 ${documentPath} 和 ${ledgerPath} 继续 ${name}。当前 revision 为 ${submissionState ?? "unsubmitted"}，控制权在 ${controlOwner ?? "unknown"}。构想候选就绪后先同步到 primary，再用 silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent 为准确的当前 revision 记录 ${submitAction}；无需 replay cursor 或 expected length。在该 Submit 对当前 revision 生效前不要请求 ${action}。不要直接编辑 events.jsonl。`;
  }
  return `继续在 ${documentPath} 和 ${ledgerPath} 推进 idea ${name}，并保留其他世界。构想契约就绪后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 approvedRevision。`;
}
