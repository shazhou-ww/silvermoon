/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * Used when a selected active idea has a primary-bound review candidate.
 */

/** @pure */
export default function reviewPresentationInstruction() {
  return "At the human gate, first render the reported review candidate as a standalone, completed assistant message with host-clickable local links and immutable primary links. Treat response.review.presentation as authoritative for every fixed gate label, document label, primary connector, and the exact decision question. When requiresLocalization is false, preserve those strings verbatim; when it is true, localize every human-visible presentation string into contentLanguage while preserving machine identifiers. Add only the idea identity, one-sentence focus, and selected review links in the reported compact order. Do not open an interactive decision in that same turn; its tool surface can hide the review index.";
}
