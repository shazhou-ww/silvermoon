/**
 * @template lifecycle-implemented
 * @when idea.state=implementing and current revision submitted
 * 用于已提交的实现 revision 等待 review，或继续当前阶段交流时。
 */
import type { LifecycleImplementedParameters } from "../contract.ts";

/** @pure */
const submittedUpstream = ({
  action,
  eventDigest,
  ideaId,
  primaryCommit,
  revisionReference,
  submitAction,
}: LifecycleImplementedParameters) =>
  [
    `当前实现 revision 已由 ${submitAction} 记录，控制权在 upstream。`,
    `呈现 response.review，并请求 revision reference ${revisionReference}`,
    ` 对应的明确 ${action} 决定。`,
    `只有使用 response.review 中的完整 revision`,
    ` 并通过 silvermoon event append ${ideaId}`,
    ` --expected-digest ${eventDigest ?? "<event-digest>"}`,
    ` --expected-primary ${primaryCommit} --audience agent 才能记录验收；`,
    `无需 replay cursor。`,
  ].join("");

/** @pure */
const submittedDownstream = ({
  action,
  controlOwner,
  submitAction,
}: LifecycleImplementedParameters) =>
  [
    `当前实现 revision 仍由 ${submitAction} 记录，`,
    `但控制权在 ${controlOwner ?? "unknown"}。`,
    `只继续把控制权交回 downstream 的当前阶段回复或工作；`,
    `该交流使用 ping/pong，在控制权重新回到 upstream 前不要请求 ${action}。`,
  ].join("");

/** @pure */
const lifecycleImplemented = (parameters: LifecycleImplementedParameters) =>
  parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);

export default lifecycleImplemented;
