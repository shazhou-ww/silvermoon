/**
 * @template preparation-seed
 * @when idea.state=preparing
 * 用于构想验收前要求轻量下游初版。
 */
import type { PreparationSeedParameters } from "../contract.ts";

/** @pure */
export default function preparationSeed({
  deploymentDocumentPath,
  implementationDocumentPath,
  ledgerPath,
}: PreparationSeedParameters) {
  return `请求构想验收前，把 ${implementationDocumentPath} 和 ${deploymentDocumentPath} 中的脚手架占位替换为轻量初版，并在 ${ledgerPath} 中镜像其稳定 ID 与短标题。每份下游契约最多三个高层步骤和三个可观察标准。这些可调整的初版用于校验可行性，但不属于 acceptIdeal 决定范围。`;
}
