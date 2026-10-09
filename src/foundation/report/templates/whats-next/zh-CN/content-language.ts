/**
 * @template content-language
 * @when idea.selected=true
 * 用于每个已选择 idea，以保持其有效内容语言。
 */
import type { ContentLanguageParameters } from "../contract.ts";

/** @pure */
const contentLanguage = ({
  contentLanguage: language,
}: ContentLanguageParameters) =>
  [
    `当前 idea 的阶段文件、该阶段相关辅助文件和 ledger 中的自然语言内容`,
    `使用 ${language}。`,
    `保留 canonical 标题、稳定 ID、路径和机器字段。`,
  ].join("");

export default contentLanguage;
