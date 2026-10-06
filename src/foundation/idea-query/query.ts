import { IDEA_STATES, ACTIVE_IDEA_STATES } from "../idea-model/index.ts";
import { normalizeIdeaQueryCore, queryIdeaInventoryCore } from "./rules.ts";

const QUERY_STATES = new Set([...IDEA_STATES, "active"]);

function queryStateFacts() {
  return {
    ideaStates: [...IDEA_STATES],
    activeStates: [...ACTIVE_IDEA_STATES],
    queryStates: new Set(QUERY_STATES),
  };
}

export function normalizeIdeaQuery(
  input: Parameters<typeof normalizeIdeaQueryCore>[0] = {},
) {
  return normalizeIdeaQueryCore(input, queryStateFacts());
}

export function queryIdeaInventory(
  items: Parameters<typeof queryIdeaInventoryCore>[0],
  input: Parameters<typeof normalizeIdeaQueryCore>[0],
) {
  return queryIdeaInventoryCore(items, input ?? {}, queryStateFacts());
}
