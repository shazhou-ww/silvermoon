import { createCommandRun } from "./domain.js";
import {
  normalizeIdeaQuery,
  queryIdeaInventory,
} from "./idea-query.js";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
} from "./idea-metadata.js";
import { observeSnapshot } from "./observation.js";
import { traceAsync } from "./trace.js";

export async function listIdeas({
  all,
  createdBefore,
  createdSince,
  limit,
  query,
  root = process.cwd(),
  sort,
  states,
  userHome,
} = {}) {
  const normalizedQuery = normalizeIdeaQuery({
    all,
    createdBefore,
    createdSince,
    limit,
    query,
    sort,
    states,
  });
  const intention = {
    command: "list-ideas",
    args: normalizedQuery,
  };
  const runtime = createCommandRun(intention);
  const observed = await observeSnapshot({
    root,
    userHome,
    version: { type: "worktree" },
  });
  if (!observed.projectReady) {
    return runtime.complete(
      observed.observation,
      { nextSteps: observed.findings.map(({ instruction }) => instruction) },
      { factType: "ideas.inventory-unavailable" },
    );
  }

  let items;
  try {
    items = await traceAsync(
      "ideas.inventory-metadata",
      { ideaCount: observed.layout.ideas.length },
      () => Promise.all(
        observed.layout.ideas.map((idea) =>
          readIdeaInventoryItem(observed.observation.root, idea)
        ),
      ),
    );
  } catch (caught) {
    const failure = metadataFailureObservation(
      observed,
      caught,
      "silvermoon list-ideas",
    );
    return runtime.complete(
      failure.observation,
      failure.responseContext,
      { factType: "ideas.inventory-unavailable" },
    );
  }

  const inventory = queryIdeaInventory(items, normalizedQuery);
  const {
    configuration,
    outputLanguage,
    root: repositoryRoot,
    version,
  } = observed.observation;
  return runtime.complete({
    state: "ideas-listed",
    root: repositoryRoot,
    version,
    configuration,
    outputLanguage,
    problems: [],
    summary: inventory.summary,
    ideas: inventory.ideas,
  }, {}, { factType: "ideas.listed" });
}
