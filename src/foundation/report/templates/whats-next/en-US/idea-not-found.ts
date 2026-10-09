/**
 * @template idea-not-found
 * @when selector.match=none
 * Used before navigation guidance when no ULID or unique alias matches.
 */
import type { IdeaNotFoundParameters } from "../contract.ts";

/** @pure */
export default function ideaNotFound({
  selector,
}: IdeaNotFoundParameters) {
  return `Idea ${selector} does not match an observed ULID or unique alias.`;
}
