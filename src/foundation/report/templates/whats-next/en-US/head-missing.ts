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
    nextSteps: [
      `Confirm the intended branch and files to track,`,
      `then create the initial commit.`,
    ].join(" "),
  });

export default headMissing;
