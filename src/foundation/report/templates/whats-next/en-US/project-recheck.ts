/**
 * @template project-recheck
 * @when project.ready=false
 * Used after reporting project setup findings that block what's next.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const projectRecheck = (
  _parameters: RecheckParameters,
) =>
  "The goal is a valid, complete project snapshot that preserves unrelated content.";

export default projectRecheck;
