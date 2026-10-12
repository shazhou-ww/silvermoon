import { resolve } from "node:path";

import { assembleProfessionalModel } from "../professional-model/index.ts";
import { CHECK_PASSED, pending, WHATS_NEXT_MODEL } from "./whats-next-model.ts";
import { createCommandRun } from "../foundation/command-message/index.ts";
import { ACTIVE_STATES, diagnosticProblem, dialogueReadyObservation } from "../foundation/report/index.ts";
import { inspectPhaseGuidance } from "../foundation/guidance/index.ts";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
  IdeaMetadataReadError,
} from "./shared/index.ts";
import { canonicalizeOutputLanguage } from "../foundation/language/index.ts";
import { observeSnapshot, withObservationLanguage } from "./shared/index.ts";

import { joinInstructions, lifecycleInstruction, lifecycleReview, navigationInstruction, phaseGuidanceInstructions, projectInstructions, renderIdeaNotFound, selectIdea } from "../foundation/report/index.ts";
import { assessRepositoryReadiness } from "./shared/index.ts";
import type { Diagnostic, ReadyObservation, RepositoryReadiness, SnapshotObservation } from "./shared/business-types.ts";
import { traceBusinessAsync } from "./shared/business-types.ts";
import type {
  IdeaInventoryItem,
  IdeaNotFoundObservation,
  IdeaSelectedObservation,
  NavigationReadyObservation,
  ProjectReadyObservation,
  Observation,
  ResponseContext,
} from "../foundation/report/types.ts";
export { CHANGE_SAMPLE_BYTE_LIMIT, CHANGE_SAMPLE_ITEM_LIMIT, phaseGuidanceInstructions, projectInstructions, summarizeWorktreeChanges } from "../foundation/report/index.ts";
export { assessIdeaCreationReadiness, assessRepositoryReadiness } from "./shared/index.ts";

const WHATSNEXT_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem, assembleProfessionalModel });

function navigationSource(
  observation: ProjectReadyObservation,
): ProjectReadyObservation & { ideas: NonNullable<ProjectReadyObservation["ideas"]> } {
  if (observation.ideas === undefined) {
    throw new TypeError("Ready project observation omitted its idea summary.");
  }
  return { ...observation, ideas: observation.ideas };
}

function navigationItem(
  item: Awaited<ReturnType<typeof readIdeaInventoryItem>>,
): IdeaInventoryItem {
  if (typeof item.createdAt !== "string") {
    throw new TypeError(`Idea ${item.id} is missing required navigation metadata.`);
  }
  return {
    id: item.id,
    state: item.state,
    createdAt: item.createdAt,
    ...(item.alias === undefined ? {} : { alias: item.alias }),
    ...(item.title === undefined ? {} : { title: item.title }),
  };
}

interface WhatsNextOptions {
  entryPath?: string;
  guidanceReader?: typeof inspectPhaseGuidance;
  idea?: string;
  language?: string;
  root?: string;
  userHome?: string;
}

export async function whatsNextUseCase({
  entryPath,
  guidanceReader = inspectPhaseGuidance,
  idea: selector,
  language,
  root = process.cwd(),
  userHome,
}: WhatsNextOptions = {}, ports: typeof WHATSNEXT_PORTS = WHATSNEXT_PORTS) {
  const { createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem, assembleProfessionalModel } = ports;
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
    ? `${baseRecheckCommand} --audience agent`
    : `${baseRecheckCommand} --language ${canonicalLanguage} --audience agent`;
  let outcome: { observation: Observation; responseContext: ResponseContext } | undefined;
  const model = assembleProfessionalModel(WHATS_NEXT_MODEL, () => {
    let snapshot: SnapshotObservation | undefined;
    let repository: RepositoryReadiness | undefined;
    let selected: ReadyObservation["layout"]["ideas"][number] | null = null;
    let selectedIdea: IdeaSelectedObservation["selectedIdea"] | undefined;

    function readySnapshot(): ReadyObservation {
      if (!snapshot?.projectReady) throw new TypeError("Project check must pass before navigation.");
      return snapshot;
    }
    function readyRepository() {
      if (!repository?.ready) throw new TypeError("Repository check must pass before navigation.");
      return repository;
    }
    function finish(observation: Observation, responseContext: ResponseContext) {
      outcome = { observation, responseContext };
    }
    function blocked(code: string, observation: Observation) {
      const description = observation.problems
        .map(({ type, summary }) => `${type}: ${summary}`).join("\n");
      return pending(code, description || observation.state);
    }
    return {
      async project() {
        const observed = await observeSnapshot({
          entryPath,
          outputLanguage: canonicalLanguage,
          root: requestedRoot,
          userHome,
          version: { type: "worktree" },
        });
        snapshot = observed;
        runtime.observe(observed.observation, { factType: "project.snapshot" });
        if (!observed.projectReady) {
          finish(
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
          return blocked("project", observed.observation);
        }

        selected = selectIdea(observed.layout.ideas, selector);
        if (selected?.status.language) {
          snapshot = withObservationLanguage(observed, selected.status.language);
        }
        return CHECK_PASSED;
      },
      async repository() {
        const observed = readySnapshot();
        const readiness = await assessRepositoryReadiness({
          observed,
          runtime,
          recheckCommand,
          root: observed.observation.root,
        });
        repository = readiness;
        if (!readiness.ready) {
          finish(
            readiness.observation,
            { nextSteps: readiness.instructions },
          );
          return blocked("repository", readiness.observation);
        }
        return CHECK_PASSED;
      },
      async selection() {
        const observed = readySnapshot();
        const readiness = readyRepository();
        const readyObservation = navigationSource(readiness.observation);
        let navigationObservation: NavigationReadyObservation = {
          state: "navigation-ready",
          root: readyObservation.root,
          version: readyObservation.version,
          configuration: readyObservation.configuration,
          ...(readyObservation.device === undefined
            ? {}
            : { device: readyObservation.device }),
          ...(readyObservation.schemas === undefined
            ? {}
            : { schemas: readyObservation.schemas }),
          outputLanguage: readyObservation.outputLanguage,
          problems: readyObservation.problems,
          ideas: {
            counts: readyObservation.ideas.counts,
            activeIdeas: [],
          },
        };
        if (selector === undefined || !selected) {
          let activeItems;
          try {
            const activeIds = new Set(
              readyObservation.ideas.activeIdeas.map(({ id }) => id),
            );
            activeItems = await traceBusinessAsync(
              "ideas.navigation-metadata",
              { ideaCount: activeIds.size },
              () => Promise.all(
                observed.layout.ideas
                  .filter(({ id }) => activeIds.has(id))
                  .map((idea) => readIdeaInventoryItem(observed.observation.root, idea)),
              ),
            );
          } catch (caught) {
            if (!(caught instanceof IdeaMetadataReadError)) throw caught;
            const failure = metadataFailureObservation(
              observed,
              caught,
              recheckCommand,
            );
            finish(failure.observation, failure.responseContext);
            return blocked("selection", failure.observation);
          }
          const itemsById = new Map<string, Awaited<ReturnType<typeof readIdeaInventoryItem>>>(
            activeItems.map((item: Awaited<ReturnType<typeof readIdeaInventoryItem>>) => [item.id, item]),
          );
          navigationObservation = {
            ...navigationObservation,
            ideas: {
              counts: readyObservation.ideas.counts,
              activeIdeas: readyObservation.ideas.activeIdeas.map(({ id }) => {
                const item = itemsById.get(id);
                if (item === undefined) {
                  throw new Error(`Missing observed navigation metadata for ${id}`);
                }
                return navigationItem(item);
              }),
            },
          };
        }

        if (selector === undefined) {
          finish(
            navigationObservation,
            {
              nextSteps: navigationInstruction(
                observed.layout.ideas,
                observed.outputLanguage,
              ),
            },
          );
          return pending("selection", "Select an explicit idea before lifecycle navigation.");
        }
        if (!selected) {
          const notFoundObservation: IdeaNotFoundObservation = {
            state: "idea-not-found",
            root: navigationObservation.root,
            version: navigationObservation.version,
            configuration: navigationObservation.configuration,
            ...(navigationObservation.device === undefined
              ? {}
              : { device: navigationObservation.device }),
            ...(navigationObservation.schemas === undefined
              ? {}
              : { schemas: navigationObservation.schemas }),
            outputLanguage: navigationObservation.outputLanguage,
            problems: navigationObservation.problems,
            candidates: navigationObservation.ideas.activeIdeas,
          };
          finish(
            notFoundObservation,
            {
              nextSteps: joinInstructions([
                renderIdeaNotFound(observed.outputLanguage, {
                  selector,
                }),
                navigationInstruction(observed.layout.ideas, observed.outputLanguage),
              ]),
            },
          );
          return pending("selection", `Unknown idea selector: ${selector}.`);
        }

        selectedIdea = {
          id: selected.id,
          ...(selected.alias === undefined ? {} : { alias: selected.alias }),
          state: selected.state,
          ...(selected.control === undefined ? {} : { control: selected.control }),
          ...(selected.submissions === undefined
            ? {}
            : { submissions: selected.submissions }),
          ...(selected.eventDigest === undefined
            ? {}
            : { eventDigest: selected.eventDigest }),
        };
        return CHECK_PASSED;
      },
      async guidance() {
        const observed = readySnapshot();
        const readiness = readyRepository();
        if (selected === null || selectedIdea === undefined) {
          throw new TypeError("Selection check must pass before phase guidance.");
        }
        const readyObservation = navigationSource(readiness.observation);
        const primary = readiness.primary
          ?? (() => {
            throw new TypeError("Repository readiness omitted the primary revision.");
          })();
        const review = lifecycleReview(selected, primary, observed.contentLanguage);
        let guidance;
        if (ACTIVE_STATES.has(selected.state)) {
          const inspected = await guidanceReader({
            gitRoot: readiness.observation.root,
            phase: selected.state,
            snapshotTree: primary,
          });
          if (inspected.state === "invalid") {
            finish(
              dialogueReadyObservation(
                readiness.observation,
                "phase-guidance-invalid",
                {
                  selectedIdea,
                  problems: inspected.diagnostics.map((diagnostic: Diagnostic) =>
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
            return pending("guidance", "The selected phase guidance is invalid.");
          }
          guidance = inspected.state === "valid" ? inspected.guidance : undefined;
        }
        const selectedObservation: IdeaSelectedObservation = {
          state: "idea-selected",
          root: readyObservation.root,
          version: readyObservation.version,
          configuration: readyObservation.configuration,
          ...(readyObservation.device === undefined
            ? {}
            : { device: readyObservation.device }),
          ...(readyObservation.schemas === undefined
            ? {}
            : { schemas: readyObservation.schemas }),
          outputLanguage: readyObservation.outputLanguage,
          problems: readyObservation.problems,
          selectedIdea,
          ...(guidance === undefined ? {} : { guidance }),
        };
        finish(
          selectedObservation,
          {
            nextSteps: lifecycleInstruction(
              selected,
              observed.outputLanguage,
              observed.contentLanguage,
              primary,
            ),
            ...(review === undefined ? {} : { review }),
          },
        );
        return CHECK_PASSED;
      },
      async ideal() {
        if (selected === null) throw new TypeError("Missing selected idea.");
        return selected.state === "implementing"
          || selected.state === "deploying" || selected.state === "completed"
          ? CHECK_PASSED : pending("ideal", `Idea lifecycle is ${selected.state}.`);
      },
      async inner() {
        if (selected === null) throw new TypeError("Missing selected idea.");
        return selected.state === "deploying" || selected.state === "completed"
          ? CHECK_PASSED : pending("inner", `Idea lifecycle is ${selected.state}.`);
      },
      async outer() {
        if (selected === null) throw new TypeError("Missing selected idea.");
        return selected.state === "completed"
          ? CHECK_PASSED : pending("outer", `Idea lifecycle is ${selected.state}.`);
      },
    };
  });
  await model.observe({ root: requestedRoot, ...(selector === undefined ? {} : { idea: selector }) });
  if (outcome === undefined) throw new TypeError("Navigation checks omitted the report.");
  return runtime.complete(outcome.observation, outcome.responseContext);
}

export async function whatsNext(options: WhatsNextOptions = {}) {
  return whatsNextUseCase(options);
}
