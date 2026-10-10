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
  `Idea ${selector} does not match an observed ULID or unique alias.`;

export default ideaNotFound;
