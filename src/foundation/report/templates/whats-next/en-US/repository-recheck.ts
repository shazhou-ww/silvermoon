/**
 * @template repository-recheck
 * @when repository.ready=false
 * Used after listing all applicable local repository recovery steps.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const repositoryRecheck = (
  _parameters: RecheckParameters,
) =>
  "The goal is a repository that satisfies every reported readiness condition while preserving unknown work.";

export default repositoryRecheck;
