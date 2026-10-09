/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * 用于无法读取已观察 active idea 的 navigation metadata 时。
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
export default function ideaMetadataUnavailable({
  command,
  message,
}: MetadataUnavailableParameters) {
  return {
    summary: `无法读取 idea metadata：${message}`,
    nextSteps: `修复报告的 idea document 后，重新运行 \`${command}\`。`,
  };
}
