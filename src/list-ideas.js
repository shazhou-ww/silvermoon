import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommandRun } from "./domain.js";
import {
  extractIdeaTitle,
  ideaInventoryItem,
  normalizeIdeaQuery,
  queryIdeaInventory,
} from "./idea-query.js";
import { canonicalizeOutputLanguage, localize } from "./language.js";
import { observeSnapshot } from "./observation.js";
import { traceAsync } from "./trace.js";

async function readInventoryItem(root, idea) {
  const documentPath = idea.worlds.idealRevision.documentPath;
  try {
    const source = await readFile(
      resolve(root, ...documentPath.split("/")),
      "utf8",
    );
    return ideaInventoryItem(idea, extractIdeaTitle(source));
  } catch (caught) {
    throw new Error(
      `Cannot read idea metadata for ${idea.id} at ${documentPath}: ${caught.message}`,
      { cause: caught },
    );
  }
}

function metadataFailureObservation(observed, caught) {
  const { ideas: _ideas, ...base } = observed.observation;
  const problem = {
    type: "idea-metadata-unavailable",
    summary: localize(
      observed.outputLanguage,
      caught.message,
      `无法读取 idea metadata：${caught.message}`,
    ),
  };
  return {
    observation: {
      ...base,
      state: "project-setup-required",
      observedThrough: "configuration",
      problems: [problem],
    },
    responseContext: {
      nextSteps: localize(
        observed.outputLanguage,
        "Repair the reported idea document and retry `silvermoon list-ideas`.",
        "修复报告的 idea document 后，重新运行 `silvermoon list-ideas`。",
      ),
    },
  };
}

export async function listIdeas({
  all,
  createdBefore,
  createdSince,
  language,
  limit,
  query,
  root = process.cwd(),
  sort,
  states,
  userHome,
} = {}) {
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

  let items;
  try {
    items = await traceAsync(
      "ideas.inventory-metadata",
      { ideaCount: observed.layout.ideas.length },
      () => Promise.all(
        observed.layout.ideas.map((idea) =>
          readInventoryItem(observed.observation.root, idea)
        ),
      ),
    );
  } catch (caught) {
    const failure = metadataFailureObservation(observed, caught);
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
