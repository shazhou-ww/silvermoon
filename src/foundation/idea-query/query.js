import { IDEA_STATES, ACTIVE_IDEA_STATES } from "../idea-model/index.js";
import { normalizeIdeaQueryCore, queryIdeaInventoryCore } from "./rules.js";

const QUERY_STATES = new Set([...IDEA_STATES, "active"]);

function queryStateFacts() {
  return {
    ideaStates: [...IDEA_STATES],
    activeStates: [...ACTIVE_IDEA_STATES],
    queryStates: new Set(QUERY_STATES),
  };
}

export function normalizeIdeaQuery(input = {}) {
  return normalizeIdeaQueryCore(input, queryStateFacts());
}

export function queryIdeaInventory(items, input) {
  return queryIdeaInventoryCore(items, input, queryStateFacts());
}
