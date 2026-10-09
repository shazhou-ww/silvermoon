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
  idealPath,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
  worldPath,
}: LifecycleImplementingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中继续 ${name}；除非理想世界确实变化，否则不要修改 ${idealPath}。`;
  }
  return `按具体工作需要，在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中细化 idea ${name} 的准备阶段初版。除非理想契约确实需要变化，否则不要修改 ${idealPath}。全部实现证据发布后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 implementationAcceptedRevision。`;
}
