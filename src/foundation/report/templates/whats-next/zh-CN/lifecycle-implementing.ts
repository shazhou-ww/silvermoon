/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * 用于 acceptInner 前继续推进实现工作时。
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleImplementing({
  action,
  documentPath,
  eventBacked,
  ideaId,
  idealPath,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  worldPath,
}: LifecycleImplementingParameters) {
  if (eventBacked) {
    return `在 ${documentPath} 和 ${ledgerPath} 继续 ${name}。先同步候选到 primary，再请求 ${action} 人工决定（revision reference ${revisionReference}）；准确决定记录使用 response.review 中的完整 revision。之后用 silvermoon event replay ${ideaId} --audience agent 观察，并通过 silvermoon event append 绑定准确流长度、文件 digest 和刷新后的 primary 写入；不要直接编辑 events.jsonl。`;
  }
  return `按具体工作需要，在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中细化 idea ${name} 的准备阶段初版。除非理想契约确实需要变化，否则不要修改 ${idealPath}。全部实现证据发布后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 implementationAcceptedRevision。`;
}
