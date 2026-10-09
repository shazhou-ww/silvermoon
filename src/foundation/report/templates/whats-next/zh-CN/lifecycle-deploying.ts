/**
 * @template lifecycle-deploying
 * @when idea.state=deploying
 * 用于 acceptOuter 前继续推进部署工作时。
 */
import type { LifecycleDeployingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleDeploying({
  action,
  documentPath,
  eventBacked,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
  worldPath,
}: LifecycleDeployingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中继续 ${name}。`;
  }
  return `从 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 细化 idea ${name} 的准备阶段初版，并保留内层世界。外部证据完成且发布后，请用户明确验收 revision reference ${revisionReference} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${statusPath} 的 deploymentAcceptedRevision。`;
}
