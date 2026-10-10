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
  `After completing every applicable step, run ${recheckCommand} again.`;

export default repositoryRecheck;
