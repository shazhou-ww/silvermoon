/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * Used when a selected active idea has a primary-bound review candidate.
 */

/** @pure */
const reviewPresentationInstruction = () =>
  [
    `Send the fenced review template as a standalone assistant message,`,
    `then end the turn.`,
    `Do not open an interactive decision in that same turn.`,
  ].join(" ");

export default reviewPresentationInstruction;
