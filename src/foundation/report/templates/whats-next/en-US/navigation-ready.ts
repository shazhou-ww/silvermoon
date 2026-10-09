/**
 * @template navigation-ready
 * @when selector.present=false
 * Used when the caller must explicitly choose an active idea or a new idea.
 */
import type { NavigationParameters } from "../contract.ts";

/** @pure */
export default function navigationReady({
  hasActiveIdea,
}: NavigationParameters) {
  return [
    "Choose explicitly whether to continue an active idea or create a new one.",
    hasActiveIdea ? null : "No active ideas are available.",
    "To continue, run `silvermoon whats-next <ULID-or-alias>`. To start something else, discuss the goal and run `silvermoon create-idea`.",
  ].filter(Boolean).join("\n");
}
