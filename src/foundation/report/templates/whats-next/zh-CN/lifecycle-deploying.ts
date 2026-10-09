/**
 * @template lifecycle-deploying
 * @when idea.state=deploying
 * 用于 acceptOuter 前继续推进部署工作时。
 */
import type { LifecycleDeployingParameters } from "../contract.ts";

/** @pure */
const lifecycleDeploying = ({
  action,
  controlOwner,
  documentPath,
  ideaId,
  ledgerPath,
  name,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleDeployingParameters) =>
  [
    `在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中继续 ${name}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `外部证据就绪后先同步到 primary，`,
    `再用 silvermoon event replay ${ideaId} --audience agent`,
    ` 和 silvermoon event append 为准确的当前 revision 记录 ${submitAction}；`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecycleDeploying;
