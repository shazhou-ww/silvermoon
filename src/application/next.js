import { resolve } from "node:path";

import { createCommandRun } from "../command/index.js";
import { ACTIVE_STATES, diagnosticProblem, dialogueReadyObservation, localize } from "../response/index.js";
import { inspectPhaseGuidance } from "../project/index.js";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
} from "./observation/index.js";
import { canonicalizeOutputLanguage } from "../project/rules/index.js";
import { observeSnapshot, withObservationLanguage } from "./observation/index.js";
import { traceAsync } from "../command/trace/index.js";

import {
  joinInstructions,
  lifecycleInstruction, navigationInstruction,
  phaseGuidanceInstructions,
  projectInstructions,
  selectIdea
} from "../response/index.js";
import { assessRepositoryReadiness } from "./observation/index.js";
export { CHANGE_SAMPLE_BYTE_LIMIT, CHANGE_SAMPLE_ITEM_LIMIT, phaseGuidanceInstructions, projectInstructions, summarizeWorktreeChanges } from "../response/index.js";
export { assessIdeaCreationReadiness, assessRepositoryReadiness } from "./observation/index.js";

const WHATSNEXT_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem });

export async function whatsNextUseCase({
  guidanceReader = inspectPhaseGuidance,
  idea: selector,
  language,
  root = process.cwd(),
  userHome,
} = {}, ports = WHATSNEXT_PORTS) {
  const { createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem } = ports;
  const canonicalLanguage = language === undefined
    ? undefined
    : canonicalizeOutputLanguage(language);
  const requestedRoot = resolve(root);
  const intention = {
    command: "whats-next",
    args: {
      idea: selector ?? null,
      language: canonicalLanguage ?? null,
    },
  };
  const runtime = createCommandRun(intention);
  const baseRecheckCommand = selector === undefined
    ? "silvermoon whats-next"
    : `silvermoon whats-next ${JSON.stringify(selector)}`;
  const recheckCommand = canonicalLanguage === undefined
    ? baseRecheckCommand
    : `${baseRecheckCommand} --language ${canonicalLanguage}`;
  let observed = await observeSnapshot({
    outputLanguage: canonicalLanguage,
    root: requestedRoot,
    userHome,
    version: { type: "worktree" },
  });
  runtime.observe(observed.observation, { factType: "project.snapshot" });
  if (!observed.projectReady) {
    return runtime.complete(
      observed.observation,
      {
        nextSteps: projectInstructions(
          observed,
          observed.observation.root,
          observed.outputLanguage,
          recheckCommand,
        ),
      },
    );
  }

  const selected = selectIdea(observed.layout.ideas, selector);
  if (selected?.status.language) {
    observed = withObservationLanguage(observed, selected.status.language);
  }
  const readiness = await assessRepositoryReadiness({
    observed,
    runtime,
    recheckCommand,
    root: observed.observation.root,
  });
  if (!readiness.ready) {
    return runtime.complete(
      readiness.observation,
      { nextSteps: readiness.instructions },
    );
  }

  let navigationObservation = readiness.observation;
  if (selector === undefined || !selected) {
    let activeItems;
    try {
      const activeIds = new Set(
        readiness.observation.ideas.activeIdeas.map(({ id }) => id),
      );
      activeItems = await traceAsync(
        "ideas.navigation-metadata",
        { ideaCount: activeIds.size },
        () => Promise.all(
          observed.layout.ideas
            .filter(({ id }) => activeIds.has(id))
            .map((idea) => readIdeaInventoryItem(observed.observation.root, idea)),
        ),
      );
    } catch (caught) {
      const failure = metadataFailureObservation(
        observed,
        caught,
        recheckCommand,
      );
      return runtime.complete(failure.observation, failure.responseContext);
    }
    const itemsById = new Map(activeItems.map((item) => [item.id, item]));
    navigationObservation = {
      ...readiness.observation,
      ideas: {
        ...readiness.observation.ideas,
        activeIdeas: readiness.observation.ideas.activeIdeas.map(({ id }) => {
          const item = itemsById.get(id);
          if (item === undefined) {
            throw new Error(`Missing observed navigation metadata for ${id}`);
          }
          return item;
        }),
      },
    };
  }

  if (selector === undefined) {
    return runtime.complete(
      { ...navigationObservation, state: "navigation-ready" },
      {
        nextSteps: navigationInstruction(
          observed.layout.ideas,
          observed.outputLanguage,
        ),
      },
    );
  }
  if (!selected) {
    return runtime.complete(
      dialogueReadyObservation(navigationObservation, "idea-not-found", {
        candidates: navigationObservation.ideas.activeIdeas,
      }),
      {
        nextSteps: joinInstructions([
          localize(
            observed.outputLanguage,
            `Idea ${selector} does not match an observed ULID or unique alias.`,
            `Idea ${selector} 未匹配任何已观察到的 ULID 或唯一 alias。`,
          ),
          navigationInstruction(observed.layout.ideas, observed.outputLanguage),
        ]),
      },
    );
  }

  const selectedIdea = {
    id: selected.id,
    ...(selected.alias === undefined ? {} : { alias: selected.alias }),
    state: selected.state,
  };
  let guidance;
  if (ACTIVE_STATES.has(selected.state)) {
    const inspected = await guidanceReader({
      gitRoot: readiness.observation.root,
      phase: selected.state,
      snapshotTree: readiness.primary,
    });
    if (inspected.state === "invalid") {
      return runtime.complete(
        dialogueReadyObservation(
          readiness.observation,
          "phase-guidance-invalid",
          {
            selectedIdea,
            problems: inspected.diagnostics.map((diagnostic) =>
              diagnosticProblem(diagnostic, observed.outputLanguage)
            ),
          },
        ),
        {
          nextSteps: phaseGuidanceInstructions(
            inspected.diagnostics,
            readiness.observation.root,
            observed.outputLanguage,
            recheckCommand,
          ),
        },
      );
    }
    guidance = inspected.guidance;
  }
  return runtime.complete(
    dialogueReadyObservation(readiness.observation, "idea-selected", {
      selectedIdea,
      ...(guidance === undefined ? {} : { guidance }),
    }),
    {
      nextSteps: lifecycleInstruction(
        selected,
        observed.outputLanguage,
        observed.contentLanguage,
      ),
    },
  );
}

export async function whatsNext(options = {}) {
  return whatsNextUseCase(options);
}
