/**
 * @template lifecycle-deployed
 * @when idea.state=deploying and current revision submitted
 * 用于已提交的部署 revision 等待 review，或继续当前阶段交流时。
 */
import type { LifecycleDeployedParameters } from "../contract.ts";

/** @pure */
const submittedUpstream = ({
  action,
  ideaId,
  revisionReference,
  submitAction,
}: LifecycleDeployedParameters) =>
  [
    `当前部署 revision 已由 ${submitAction} 记录，控制权在 upstream。`,
    `呈现 response.review，并请求 revision reference ${revisionReference}`,
    ` 对应的明确 ${action} 决定。`,
    `只有使用 response.review 中的完整 revision`,
    ` 和 silvermoon event replay ${ideaId} --audience agent 的准确 cursor 才能记录验收。`,
  ].join("");

/** @pure */
const submittedDownstream = ({
  action,
  controlOwner,
  submitAction,
}: LifecycleDeployedParameters) =>
  [
    `当前部署 revision 仍由 ${submitAction} 记录，`,
    `但控制权在 ${controlOwner ?? "unknown"}。`,
    `只继续把控制权交回 downstream 的当前阶段回复或工作；`,
    `该交流使用 ping/pong，在控制权重新回到 upstream 前不要请求 ${action}。`,
  ].join("");

/** @pure */
const lifecycleDeployed = (parameters: LifecycleDeployedParameters) =>
  parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);

export default lifecycleDeployed;
