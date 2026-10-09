/**
 * @template lifecycle-inactive
 * @when idea.state=abandoned|completed
 * Used when the selected idea cannot continue without a new human decision.
 */
import type { LifecycleInactiveParameters } from "../contract.ts";

/** @pure */
export default function lifecycleInactive({
  eventBacked,
  name,
  relativePath,
  state,
  statusPath,
}: LifecycleInactiveParameters) {
  if (eventBacked) {
    return `Review ${name} (${state}); preserve decisions. Resume only through idea.resumed after an explicit human decision; revise world content for changed requirements.`;
  }
  if (state === "abandoned") {
    return `Review abandoned idea ${name} at ${relativePath}. Keep abandoned: true in ${statusPath}, remove it only after an explicit decision to resume, or discuss a different goal and run silvermoon create-idea.`;
  }
  return `Review completed idea ${name} at ${relativePath}. If its definition must change, revise the existing idea; otherwise discuss a new goal and run silvermoon create-idea.`;
}
