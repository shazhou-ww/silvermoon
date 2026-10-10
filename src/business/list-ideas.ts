import { createCommandRun } from "../foundation/command-message/index.ts";
import { ideaInventoryItem, normalizeIdeaQuery, queryIdeaInventory } from "../foundation/idea-query/index.ts";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
} from "./shared/index.ts";
import { canonicalizeOutputLanguage } from "../foundation/language/index.ts";
import { observeSnapshot } from "./shared/index.ts";
import type { ObservedIdea } from "./shared/idea-layout.ts";
import { traceBusinessAsync } from "./shared/business-types.ts";
import type { IdeaInventoryItem as ReportInventoryItem } from "../foundation/report/types.ts";

type InventoryItem = ReturnType<typeof ideaInventoryItem>;
type NormalizedQuery = ReturnType<typeof normalizeIdeaQuery>;
type MetadataReader = (root: string, idea: ObservedIdea) => Promise<InventoryItem>;

class UntitledReportInventoryItem implements ReportInventoryItem {
  readonly id: string;
  readonly state: string;
  readonly createdAt: string;

  constructor(
    id: string,
    state: string,
    createdAt: string,
    alias?: string,
  ) {
    this.id = id;
    this.state = state;
    this.createdAt = createdAt;
    if (alias !== undefined) {
      Object.defineProperty(this, "alias", {
        enumerable: true,
        value: alias,
      });
    }
  }

  get title(): string {
    return "";
  }
}

function reportInventoryItem(item: InventoryItem): ReportInventoryItem {
  if (typeof item.createdAt !== "string") {
    throw new TypeError(`Idea ${item.id} is missing its creation timestamp.`);
  }
  if (item.title === undefined) {
    return new UntitledReportInventoryItem(
      item.id,
      item.state,
      item.createdAt,
      item.alias,
    );
  }
  return {
    id: item.id,
    state: item.state,
    createdAt: item.createdAt,
    title: item.title,
    ...(item.alias === undefined ? {} : { alias: item.alias }),
  };
}

interface ListIdeasOptions {
  all?: boolean;
  createdBefore?: string;
  createdSince?: string;
  entryPath?: string;
  language?: string;
  limit?: number | null;
  metadataReader?: MetadataReader;
  query?: string;
  root?: string;
  sort?: "created-asc" | "created-desc" | "updated-asc" | "updated-desc";
  states?: string[];
  userHome?: string;
}

function withoutTitleQuery(
  query: NormalizedQuery,
  { limit = query.limit }: { limit?: number | null } = {},
) {
  return { ...query, limit, query: null };
}

function matchesIdentity(item: InventoryItem, needle: string): boolean {
  return [item.id, item.alias]
    .filter((value) => value !== undefined)
    .some((value) => value.toLowerCase().includes(needle));
}

async function queryObservedInventory({
  ideas,
  metadataReader,
  normalizedQuery,
  root,
}: {
  ideas: ObservedIdea[];
  metadataReader: MetadataReader;
  normalizedQuery: NormalizedQuery;
  root: string;
}) {
  const ideasById = new Map(ideas.map((idea) => [idea.id, idea]));
  const baseItems = ideas.map((idea) => ideaInventoryItem(idea));
  const candidates = queryIdeaInventory(
    baseItems,
    withoutTitleQuery(normalizedQuery, { limit: null }),
  ).ideas;

  return traceBusinessAsync(
    "ideas.inventory-metadata",
    {
      candidateCount: candidates.length,
      ideaCount: ideas.length,
    },
    async () => {
      const loadedItems = new Map<string, InventoryItem>();
      let queryCandidateCount = 0;
      let titleReadCount = 0;

      const readItems = async (items: InventoryItem[]) => {
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
    ({ inventory, queryCandidateCount, titleReadCount }: {
      inventory: { summary: { matched: number; returned: number }; ideas: InventoryItem[] };
      queryCandidateCount: number;
      titleReadCount: number;
    }) => ({
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
  entryPath,
  language,
  limit,
  metadataReader = readIdeaInventoryItem,
  query,
  root = process.cwd(),
  sort,
  states,
  userHome,
}: ListIdeasOptions = {}, ports: typeof LISTIDEAS_PORTS = LISTIDEAS_PORTS) {
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
    entryPath,
    root,
    outputLanguage: canonicalLanguage,
    requireCurrentSchemas: false,
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
    ...(observed.observation.device === undefined
      ? {}
      : { device: observed.observation.device }),
    ...(observed.observation.schemas === undefined
      ? {}
      : { schemas: observed.observation.schemas }),
    outputLanguage,
    problems: [],
    summary: inventory.summary,
    ideas: inventory.ideas.map(reportInventoryItem),
  }, {}, { factType: "ideas.listed" });
}

export async function listIdeas(options: ListIdeasOptions = {}) {
  return listIdeasUseCase(options);
}
