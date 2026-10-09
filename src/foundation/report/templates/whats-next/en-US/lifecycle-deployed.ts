/**
 * @template lifecycle-deployed
 * @when idea.state=deploying and current revision submitted
 * Used when the submitted deployment is ready for review or phase-local exchange.
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
    `The current deployment revision was recorded by ${submitAction}; control is upstream.`,
    `Present response.review and request the explicit ${action} decision`,
    `for revision reference ${revisionReference}.`,
    `Record an acceptance only with the full revision from response.review`,
    `and an exact silvermoon event replay ${ideaId} --audience agent cursor.`,
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
    `Continue only the phase-local response or work that returned control downstream;`,
    `use ping/pong for that exchange and do not request ${action} until control returns upstream.`,
  ].join(" ");

/** @pure */
const lifecycleDeployed = (parameters: LifecycleDeployedParameters) =>
  parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);

export default lifecycleDeployed;
