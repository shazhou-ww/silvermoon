/**
 * @template head-missing
 * @when repository.head=null
 * Used when the repository has no initial commit.
 */
import type { SummaryAndNextSteps } from "../contract.ts";

/** @pure */
const headMissing = (): SummaryAndNextSteps =>
  ({
    summary: "The repository has no commit at HEAD.",
    nextSteps:
      "The goal is a repository HEAD commit that preserves the intended initial project content.",
  });

export default headMissing;
