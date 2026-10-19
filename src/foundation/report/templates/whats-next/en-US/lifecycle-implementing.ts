/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * Used when implementation work continues before acceptInner.
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
const lifecycleImplementing = ({
  action,
  documentPath,
  eventDigest,
  ideaId,
  idealDocumentPath,
  ledgerPath,
  name,
  primaryCommit,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) =>
  [
    `The goal is to complete implementation evidence for the exact current`,
    `revision of idea \`${name}\` and make that revision current on primary before submission.`,
    `Possible work areas are phase file \`${documentPath}\`, related supporting files`,
    `under \`${worldPath}\`, and ledger \`${ledgerPath}\`.`,
    `Keep the canonical idea file \`${idealDocumentPath}\` unchanged unless the requirements themselves must change.`,
    `When the evidence is ready, one possible submission path is to synchronize`,
    `the revision to primary and then use \`silvermoon event append ${ideaId}`,
    `--expected-digest ${eventDigest ?? "<event-digest>"}`,
    `--expected-primary ${primaryCommit} --format markdown\``,
    `to record ${submitAction} for the exact current revision;`,
    `no replay cursor or expected length is required.`,
    `The ${action} gate remains unavailable until that Submit is current,`,
    `and events.jsonl must remain append-only through the command surface.`,
  ].join(" ");

export default lifecycleImplementing;
