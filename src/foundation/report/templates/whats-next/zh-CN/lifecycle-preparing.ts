/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * 用于 acceptIdeal 前继续推进构想契约时。
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
const lifecyclePreparing = ({
  action,
  controlOwner,
  documentPath,
  ideaId,
  ledgerPath,
  name,
  submissionState,
  submitAction,
}: LifecyclePreparingParameters) =>
  [
    `在 ${documentPath} 和 ${ledgerPath} 继续 ${name}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `构想候选就绪后先同步到 primary，`,
    `再用 silvermoon event replay ${ideaId} --audience agent`,
    ` 和 silvermoon event append 为准确的当前 revision 记录 ${submitAction}；`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecyclePreparing;
