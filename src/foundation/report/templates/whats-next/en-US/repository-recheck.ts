/**
 * @template repository-recheck
 * @when repository.ready=false
 * Used after listing all applicable local repository recovery steps.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const repositoryRecheck = ({
  recheckCommand,
}: RecheckParameters) =>
  `Once the repository reaches the intended state, ${recheckCommand} can verify that the blocker is resolved.`;

export default repositoryRecheck;
