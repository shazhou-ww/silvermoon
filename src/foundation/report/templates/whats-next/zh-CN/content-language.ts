/**
 * @template content-language
 * @when idea.selected=true
 * 用于每个已选择 idea，以保持其有效内容语言。
 */
import type { ContentLanguageParameters } from "../contract.ts";

/** @pure */
export default function contentLanguage({
  contentLanguage: language,
}: ContentLanguageParameters) {
  return `在当前世界、同世界辅助文件和 ledger 的自然语言内容中使用 ${language}。保留 canonical 标题、稳定 ID、路径和机器字段。`;
}
