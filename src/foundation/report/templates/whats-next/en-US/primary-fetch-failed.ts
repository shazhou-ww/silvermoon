/**
 * @template primary-fetch-failed
 * @when repository.fetchPrimary=failed
 * Used when primary cannot be fetched before navigation.
 */
import type { PrimaryFetchFailedParameters } from "../contract.ts";

/** @pure */
const primaryFetchFailed = ({
  primaryBranch,
  primaryRepository,
  recheckCommand,
}: PrimaryFetchFailedParameters) =>
  [
    `Check network access, authorization, ${primaryRepository}, and branch ${primaryBranch};`,
    `after an observable fix, run ${recheckCommand} again.`,
  ].join(" ");

export default primaryFetchFailed;
