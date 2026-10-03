import { createCommandRun } from "../command/index.js";
import {
  ideaInventoryItem,
  normalizeIdeaQuery,
  queryIdeaInventory,
} from "../idea/index.js";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
} from "./observation/index.js";
import { canonicalizeOutputLanguage } from "../project/rules/index.js";
import { observeSnapshot } from "./observation/index.js";
import { traceAsync } from "../command/trace/index.js";

function withoutTitleQuery(query, { limit = query.limit } = {}) {
  return { ...query, limit, query: null };
}

function matchesIdentity(item, needle) {
  return [item.id, item.alias]
    .filter((value) => value !== undefined)
    .some((value) => value.toLowerCase().includes(needle));
}

async function queryObservedInventory({
  ideas,
  metadataReader,
  normalizedQuery,
  root,
}) {
  const ideasById = new Map(ideas.map((idea) => [idea.id, idea]));
  const baseItems = ideas.map((idea) => ideaInventoryItem(idea));
  const candidates = queryIdeaInventory(
    baseItems,
    withoutTitleQuery(normalizedQuery, { limit: null }),
  ).ideas;

  return traceAsync(
    "ideas.inventory-metadata",
    {
      candidateCount: candidates.length,
      ideaCount: ideas.length,
    },
    async () => {
      const loadedItems = new Map();
      let queryCandidateCount = 0;
      let titleReadCount = 0;

      const readItems = async (items) => {
        const unread = items.filter(({ id }) => !loadedItems.has(id));
        titleReadCount += unread.length;
        const loaded = await Promise.all(unread.map(({ id }) => {
          const idea = ideasById.get(id);
          if (idea === undefined) {
            throw new Error(`Missing observed idea metadata for ${id}`);
          }
          return metadataReader(root, idea);
        }));
        for (const item of loaded) loadedItems.set(item.id, item);
      };

      let matchingItems = candidates;
      if (normalizedQuery.query !== null) {
        const needle = normalizedQuery.query.toLowerCase();
        const directMatchIds = new Set(
          candidates
            .filter((item) => matchesIdentity(item, needle))
            .map(({ id }) => id),
        );
        const titleCandidates = candidates.filter(
          ({ id }) => !directMatchIds.has(id),
        );
        queryCandidateCount = titleCandidates.length;
        await readItems(titleCandidates);
        matchingItems = candidates
          .filter(({ id }) =>
            directMatchIds.has(id)
            || loadedItems.get(id)?.title?.toLowerCase().includes(needle)
          )
          .map((item) => loadedItems.get(item.id) ?? item);
      }

      const selected = queryIdeaInventory(
        matchingItems,
        withoutTitleQuery(normalizedQuery),
      );
      await readItems(selected.ideas);
      const inventory = {
        summary: selected.summary,
        ideas: selected.ideas.map(({ id }) => {
          const item = loadedItems.get(id);
          if (item === undefined) {
            throw new Error(`Missing selected idea metadata for ${id}`);
          }
          return item;
        }),
      };
      return { inventory, queryCandidateCount, titleReadCount };
    },
    ({ inventory, queryCandidateCount, titleReadCount }) => ({
      attributes: {
        matchedCount: inventory.summary.matched,
        queryCandidateCount,
        returnedCount: inventory.summary.returned,
        titleReadCount,
      },
    }),
  );
}

const LISTIDEAS_PORTS = Object.freeze({ createCommandRun, observeSnapshot });

export async function listIdeasUseCase({
  all,
  createdBefore,
  createdSince,
  language,
  limit,
  metadataReader = readIdeaInventoryItem,
  query,
  root = process.cwd(),
  sort,
  states,
  userHome,
} = {}, ports = LISTIDEAS_PORTS) {
  const { createCommandRun, observeSnapshot } = ports;
  const canonicalLanguage = language === undefined
    ? undefined
    : canonicalizeOutputLanguage(language);
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
    args: {
      ...normalizedQuery,
      language: canonicalLanguage ?? null,
    },
  };
  const runtime = createCommandRun(intention);
  const observed = await observeSnapshot({
    root,
    outputLanguage: canonicalLanguage,
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

  let queried;
  try {
    queried = await queryObservedInventory({
      ideas: observed.layout.ideas,
      metadataReader,
      normalizedQuery,
      root: observed.observation.root,
    });
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

  const { inventory } = queried;
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

export async function listIdeas(options = {}) {
  return listIdeasUseCase(options);
}
