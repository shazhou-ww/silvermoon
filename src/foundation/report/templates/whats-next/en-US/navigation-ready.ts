/**
 * @template navigation-ready
 * @when selector.present=false
 * Used when the caller must explicitly choose an active idea or a new idea.
 */
import type { NavigationParameters } from "../contract.ts";

/** @pure */
const navigationReady = ({
  hasActiveIdea,
}: NavigationParameters) =>
  hasActiveIdea
    ? [
      `Choose explicitly whether to continue an active idea or,`,
      `after discussing the goal, create a new one.`,
      `To continue, run \`silvermoon whats-next <ULID-or-alias>\`.`,
      `To start something else, discuss the goal, then run \`silvermoon create-idea\`.`,
    ].join(" ")
    : [
      `No active ideas are available.`,
      `Discuss the goal, then run \`silvermoon create-idea\` to create a new idea.`,
    ].join("\n");

export default navigationReady;
