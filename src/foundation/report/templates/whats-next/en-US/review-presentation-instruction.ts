/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * Used when a selected active idea has a primary-bound review candidate.
 */

/** @pure */
export default function reviewPresentationInstruction() {
  return "At the human gate, send the fenced review template rendered from response.review.presentation as one standalone, completed assistant message. Replace only its brace-delimited placeholders and link targets, following its localization instruction exactly. Do not open an interactive decision in that same turn.";
}
