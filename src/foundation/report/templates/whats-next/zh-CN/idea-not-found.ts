/**
 * @template idea-not-found
 * @when selector.match=none
 * 用于没有 ULID 或唯一 alias 匹配时，在 navigation 指示之前。
 */
import type { IdeaNotFoundParameters } from "../contract.ts";

/** @pure */
const ideaNotFound = ({
  selector,
}: IdeaNotFoundParameters) =>
  [
    `Idea ${selector} 未匹配任何已观察到的 ULID 或唯一 alias。`,
    `目标是选中预期的既有 Idea。`,
    `可选方法包括先用 \`silvermoon list-ideas\` 确认其 ULID 或唯一 alias，`,
    `再用准确 selector 重试。`,
    `如果这确实是新工作而不是既有 Idea，也可另行考虑 \`silvermoon create-idea\`。`,
  ].join("");

export default ideaNotFound;
