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
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `在 ${documentPath} 和 ${ledgerPath} 继续 ${name}。`;
  }
  return `继续在 ${documentPath} 和 ${ledgerPath} 推进 idea ${name}，并保留其他世界。构想契约就绪后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 approvedRevision。`;
}
