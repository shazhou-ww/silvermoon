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
}: PrimaryFetchFailedParameters) =>
  `The goal is for configured primary ${primaryRepository}#${primaryBranch} to be fetchable for an authoritative observation.`;

export default primaryFetchFailed;
