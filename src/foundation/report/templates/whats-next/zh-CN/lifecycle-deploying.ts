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
  eventDigest,
  ideaId,
  ledgerPath,
  name,
  primaryCommit,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleDeployingParameters) =>
  [
    `在当前阶段文件 ${documentPath}、`,
    `${worldPath} 下该阶段的相关辅助文件和 ledger ${ledgerPath} 中`,
    `继续当前 idea ${name}。`,
    `当前 revision 为 ${submissionState ?? "unsubmitted"}，`,
    `控制权在 ${controlOwner ?? "unknown"}。`,
    `外部证据就绪后先同步到 primary，`,
    `再用 silvermoon event append ${ideaId}`,
    ` --expected-digest ${eventDigest ?? "<event-digest>"}`,
    ` --expected-primary ${primaryCommit} --audience agent`,
    ` 为准确的当前 revision 记录 ${submitAction}；`,
    `无需 replay cursor 或 expected length。`,
    `在该 Submit 对当前 revision 生效前不要请求 ${action}。`,
    `不要直接编辑 events.jsonl。`,
  ].join("");

export default lifecycleDeploying;
