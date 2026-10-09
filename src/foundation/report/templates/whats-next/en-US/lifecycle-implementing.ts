/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * Used when implementation work continues before acceptInner.
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
const submittedUpstream = ({
  action,
  ideaId,
  revisionReference,
  submitAction,
}: LifecycleImplementingParameters) =>
  [
    `The current implementation revision was recorded by ${submitAction}; control is upstream.`,
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
}: LifecycleImplementingParameters) =>
  [
    `The current implementation revision remains recorded by ${submitAction},`,
    `but control is ${controlOwner ?? "unknown"}.`,
    `Continue only the phase-local response or work that returned control downstream;`,
    `use ping/pong for that exchange and do not request ${action} until control returns upstream.`,
  ].join(" ");

/** @pure */
const continueEventBacked = ({
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
    `Continue ${name} in ${documentPath}, supporting files under ${worldPath},`,
    `and ${ledgerPath}; do not change ${idealPath} unless the Ideal World must change.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When implementation evidence is ready, synchronize it to primary,`,
    `then use silvermoon event replay ${ideaId} --audience agent`,
    `and silvermoon event append to record ${submitAction} for the exact current revision.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

/** @pure */
const lifecycleImplementing = (parameters: LifecycleImplementingParameters) => {
  if (parameters.submissionState !== "submitted") {
    return continueEventBacked(parameters);
  }
  return parameters.controlOwner === "upstream"
    ? submittedUpstream(parameters)
    : submittedDownstream(parameters);
};

export default lifecycleImplementing;
