/**
 * @template lifecycle-inactive
 * @when idea.state=abandoned|completed
 * 用于已选择 idea 必须获得新人工决定才能继续时。
 */
import type { LifecycleInactiveParameters } from "../contract.ts";

/** @pure */
export default function lifecycleInactive({
  eventBacked,
  name,
  relativePath,
  state,
  statusPath,
}: LifecycleInactiveParameters) {
  if (eventBacked) {
    return `复查 ${name}（${state}），保留已有决定。只有明确人工决定才通过 idea.resumed 恢复；需求变化应修改对应世界内容。`;
  }
  if (state === "abandoned") {
    return `复查位于 ${relativePath} 的已放弃 idea ${name}。保持 ${statusPath} 中的 abandoned: true；只有明确决定恢复时才移除它，或者讨论另一个目标并运行 silvermoon create-idea。`;
  }
  return `复查位于 ${relativePath} 的已完成 idea ${name}。若其定义需要变化则修订现有 idea；否则讨论新目标并运行 silvermoon create-idea。`;
}
