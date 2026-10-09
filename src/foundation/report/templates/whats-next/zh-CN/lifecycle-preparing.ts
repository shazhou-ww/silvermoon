/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * 用于 acceptIdeal 前继续推进构想契约时。
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
export default function lifecyclePreparing({
  action,
  documentPath,
  eventBacked,
  ideaId,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    return `在 ${documentPath} 和 ${ledgerPath} 继续 ${name}。先同步候选到 primary，再请求 ${action} 人工决定（revision reference ${revisionReference}）；准确决定记录使用 response.review 中的完整 revision。之后用 silvermoon event replay ${ideaId} --audience agent 观察，并通过 silvermoon event append 绑定准确流长度、文件 digest 和刷新后的 primary 写入；不要直接编辑 events.jsonl。`;
  }
  return `继续在 ${documentPath} 和 ${ledgerPath} 推进 idea ${name}，并保留其他世界。构想契约就绪后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 approvedRevision。`;
}
