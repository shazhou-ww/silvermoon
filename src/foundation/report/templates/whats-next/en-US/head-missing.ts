/**
 * @template head-missing
 * @when repository.head=null
 * Used when the repository has no initial commit.
 */
import type { SummaryAndStep } from "../contract.ts";

/** @pure */
export default function headMissing(): SummaryAndStep {
  return {
    summary: "The repository has no commit at HEAD.",
    step: "After resolving conflicts and deciding which local changes belong, create the initial commit on the intended branch.",
  };
}
