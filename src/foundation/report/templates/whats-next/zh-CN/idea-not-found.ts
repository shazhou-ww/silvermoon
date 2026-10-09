/**
 * @template idea-not-found
 * @when selector.match=none
 * 用于没有 ULID 或唯一 alias 匹配时，在 navigation 指示之前。
 */
import type { IdeaNotFoundParameters } from "../contract.ts";

/** @pure */
export default function ideaNotFound({
  selector,
}: IdeaNotFoundParameters) {
  return `Idea ${selector} 未匹配任何已观察到的 ULID 或唯一 alias。`;
}
