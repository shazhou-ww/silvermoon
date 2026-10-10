/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * 用于无法读取已观察 active idea 的 navigation metadata 时。
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
const ideaMetadataUnavailable = ({
  command,
  documentPath,
  message,
}: MetadataUnavailableParameters) =>
  ({
    summary: `无法读取 idea metadata：${message}`,
    nextSteps: documentPath === undefined
      ? `修复报告的 idea document 后，重新运行 \`${command}\`。`
      : [
        `把 ${documentPath} 恢复为当前 idea 的 canonical Idea.md。`,
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
        `然后重新运行 \`${command}\`。`,
      ].join("\n"),
  });

export default ideaMetadataUnavailable;
