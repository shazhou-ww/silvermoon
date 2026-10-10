/**
 * @template lifecycle-inactive
 * @when idea.state=abandoned|completed
 * Used when the selected idea cannot continue without a new human decision.
 */
import type { LifecycleInactiveParameters } from "../contract.ts";

/** @pure */
const lifecycleInactive = ({
  name,
  state,
}: LifecycleInactiveParameters) =>
  [
    `Review ${name} (${state}); preserve decisions.`,
    `Resume only through idea.resumed after an explicit human decision;`,
    `update the relevant canonical phase file when requirements change.`,
  ].join(" ");

export default lifecycleInactive;
