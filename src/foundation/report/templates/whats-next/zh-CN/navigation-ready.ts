/**
 * @template navigation-ready
 * @when selector.present=false
 * 用于调用者必须明确选择 active idea 或新 idea 时。
 */
import type { NavigationParameters } from "../contract.ts";

/** @pure */
export default function navigationReady({
  hasActiveIdea,
}: NavigationParameters) {
  return [
    "请明确选择继续一个 active idea，或创建一个新 idea。",
    hasActiveIdea ? null : "当前没有 active idea。",
    "如需继续，运行 `silvermoon whats-next <ULID-or-alias>`；如需开始其他工作，先讨论目标，再运行 `silvermoon create-idea`。",
  ].filter(Boolean).join("\n");
}
