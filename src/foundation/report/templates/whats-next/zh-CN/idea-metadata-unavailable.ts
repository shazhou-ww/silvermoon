/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * 用于无法读取已观察 active idea 的 navigation metadata 时。
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
const ideaMetadataUnavailable = ({
  documentPath,
  message,
}: MetadataUnavailableParameters) =>
  ({
    summary: `无法读取 idea metadata：${message}`,
    nextSteps: documentPath === undefined
      ? "目标是得到满足 idea metadata contract 的可读取 canonical Idea.md。"
      : [
        `目标是让 ${documentPath} 成为当前 idea 可读取的 canonical Idea.md。`,
        `使用以下 canonical template：`,
        "```markdown",
        "# <标题>",
        "",
        "## 问题",
        "",
        "## 结果",
        "",
        "## 边界",
        "",
        "## 验收标准",
        "```",
      ].join("\n"),
  });

export default ideaMetadataUnavailable;
