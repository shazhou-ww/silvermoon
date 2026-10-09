/**
 * @template lifecycle-deployed
 * @when idea.state=deploying and current revision submitted
 * Used when the submitted deployment is ready for review or current-phase exchange.
 */
import type { LifecycleDeployedParameters } from "../contract.ts";

/** @pure */
const submittedUpstream = ({
  action,
  eventDigest,
  ideaId,
  primaryCommit,
  revisionReference,
  submitAction,
}: LifecycleDeployedParameters) =>
  [
    `The current deployment revision was recorded by ${submitAction}; control is upstream.`,
    `Present response.review and request the explicit ${action} decision`,
    `for revision reference ${revisionReference}.`,
    `Record an acceptance only with the full revision from response.review`,
    `using silvermoon event append ${ideaId}`,
    `--expected-digest ${eventDigest ?? "<event-digest>"}`,
    `--expected-primary ${primaryCommit} --audience agent;`,
    `no replay cursor is required.`,
  ].join(" ");

/** @pure */
const submittedDownstream = ({
  action,
  controlOwner,
  submitAction,
}: LifecycleDeployedParameters) =>
  [
    `The current deployment revision remains recorded by ${submitAction},`,
    `but control is ${controlOwner ?? "unknown"}.`,
    `Continue only the current phase response or work that returned control downstream;`,
    `use ping/pong for that exchange and do not request ${action} until control returns upstream.`,
  ].join(" ");

/** @pure */
const lifecycleDeployed = (parameters: LifecycleDeployedParameters) =>
  parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);

export default lifecycleDeployed;
