/**
 * @template idea-not-found
 * @when selector.match=none
 * Used before navigation guidance when no ULID or unique alias matches.
 */
import type { IdeaNotFoundParameters } from "../contract.ts";

/** @pure */
const ideaNotFound = ({
  selector,
}: IdeaNotFoundParameters) =>
  [
    `Idea ${selector} does not match an observed ULID or unique alias.`,
    `The goal is to select the intended existing Idea.`,
    `Possible approaches include using \`silvermoon list-ideas\` to confirm its`,
    `ULID or unique alias, then retrying with that exact selector.`,
    `If this is genuinely new work rather than an existing Idea,`,
    `\`silvermoon create-idea\` is a separate option.`,
  ].join(" ");

export default ideaNotFound;
