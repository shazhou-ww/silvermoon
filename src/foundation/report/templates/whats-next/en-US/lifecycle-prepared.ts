/**
 * @template lifecycle-prepared
 * @when idea.state=preparing and current revision submitted
 * Used when the submitted Idea revision is ready for review or phase-local exchange.
 */
import type { LifecyclePreparedParameters } from "../contract.ts";

/** @pure */
const submittedUpstream = ({
  action,
  ideaId,
  revisionReference,
  submitAction,
}: LifecyclePreparedParameters) =>
  [
    `The current Idea revision was recorded by ${submitAction}; control is upstream.`,
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
}: LifecyclePreparedParameters) =>
  [
    `The current Idea revision remains recorded by ${submitAction},`,
    `but control is ${controlOwner ?? "unknown"}.`,
    `Continue only the phase-local response or work that returned control downstream;`,
    `use ping/pong for that exchange and do not request ${action} until control returns upstream.`,
  ].join(" ");

/** @pure */
const lifecyclePrepared = (parameters: LifecyclePreparedParameters) =>
  parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);

export default lifecyclePrepared;
