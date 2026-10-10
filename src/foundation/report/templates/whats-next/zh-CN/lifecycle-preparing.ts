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
  eventDigest,
  ideaId,
  ledgerPath,
  name,
  primaryCommit,
  submissionState,
  submitAction,
}: LifecyclePreparingParameters) =>
  [
    `在当前阶段文件 ${documentPath} 和 ledger ${ledgerPath} 中继续当前 idea ${name}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `构想候选就绪后先同步到 primary，`,
    `再用 silvermoon event append ${ideaId}`,
    ` --expected-digest ${eventDigest ?? "<event-digest>"}`,
    ` --expected-primary ${primaryCommit} --audience agent`,
    ` 为准确的当前 revision 记录 ${submitAction}；`,
    `无需 replay cursor 或 expected length。`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecyclePreparing;
