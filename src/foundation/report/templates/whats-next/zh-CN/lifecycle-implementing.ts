/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * 用于 acceptInner 前继续推进实现工作时。
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
const lifecycleImplementing = ({
  action,
  controlOwner,
  documentPath,
  ideaId,
  idealPath,
  ledgerPath,
  name,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) =>
  [
    `在 ${documentPath}、${worldPath} 下的辅助文件和 ${ledgerPath} 中继续 ${name}；`,
    `除非理想世界确实变化，否则不要修改 ${idealPath}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `实现证据就绪后先同步到 primary，`,
    `再用 silvermoon event replay ${ideaId} --audience agent`,
    ` 和 silvermoon event append 为准确的当前 revision 记录 ${submitAction}；`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecycleImplementing;
