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
    `在当前阶段文件 ${documentPath}、`,
    `${worldPath} 下该阶段的相关辅助文件和 ledger ${ledgerPath} 中`,
    `继续当前 idea ${name}。`,
    `除非当前 idea 的要求必须变化，否则不要修改 canonical idea 文件 ${idealPath}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `实现证据就绪后先同步到 primary，`,
    `再用 silvermoon event replay ${ideaId} --audience agent`,
    ` 和 silvermoon event append 为准确的当前 revision 记录 ${submitAction}；`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecycleImplementing;
