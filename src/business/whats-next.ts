import { resolve } from "node:path";
import { homedir } from "node:os";

import {
  createSilvermoonObjectiveLoader, probeObjective, SILVERMOON_OBJECTIVE_URIS,
} from "./objective-guides.ts";
import type { SilvermoonObjectiveCheck } from "./objective-guides.ts";
import { ObjectiveOperationError } from "../objective-guide/index.ts";
import type { CheckResult, ObjectiveLoader } from "../objective-guide/index.ts";
import type { JsonObject } from "../objective-guide/index.ts";
import { inspectWorktreeContext, worktreeSnapshot } from "../foundation/git/index.ts";
import { observeDevice, observeIdea } from "./shared/index.ts";
import { createCommandRun } from "../foundation/command-message/index.ts";
import { ACTIVE_STATES, diagnosticProblem, dialogueReadyObservation } from "../foundation/report/index.ts";
import { inspectAllGuidance, inspectPhaseGuidance } from "../foundation/guidance/index.ts";
import {
  metadataFailureObservation,
  readIdeaInventoryItem,
  IdeaMetadataReadError,
} from "./shared/index.ts";
import { canonicalizeOutputLanguage, localize, resolveContentTemplateLanguage, resolveOutputLanguage } from "../foundation/language/index.ts";
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
  ObjectiveObservation as ObjectiveReportObservation,
  ProjectReadyObservation,
  Observation,
  ResponseContext,
} from "../foundation/report/types.ts";
export { CHANGE_SAMPLE_BYTE_LIMIT, CHANGE_SAMPLE_ITEM_LIMIT, phaseGuidanceInstructions, projectInstructions, summarizeWorktreeChanges } from "../foundation/report/index.ts";
export { assessIdeaCreationReadiness, assessRepositoryReadiness } from "./shared/index.ts";

type NavigationGateResult =
  | { passed: true }
  | {
    passed: false;
    problems: readonly [{ code: string; description: string }, ...{ code: string; description: string }[]];
  };
const CHECK_PASSED: NavigationGateResult = Object.freeze({ passed: true });
function pending(code: string, description: string): NavigationGateResult {
  return { passed: false, problems: [{ code, description }] };
}

const WHATSNEXT_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem, createSilvermoonObjectiveLoader, probeObjective, observeDevice, observeIdea, inspectWorktreeContext, worktreeSnapshot });

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
  guidanceInspector?: typeof inspectAllGuidance;
  idea?: string;
  language?: string;
  root?: string;
  userHome?: string;
}

export async function whatsNextUseCase({
  entryPath,
  guidanceReader = inspectPhaseGuidance,
  guidanceInspector = inspectAllGuidance,
  idea: selector,
  language,
  root = process.cwd(),
  userHome,
}: WhatsNextOptions = {}, ports: typeof WHATSNEXT_PORTS = WHATSNEXT_PORTS) {
  const { createCommandRun, observeSnapshot, assessRepositoryReadiness, readIdeaInventoryItem, createSilvermoonObjectiveLoader, probeObjective, observeDevice, observeIdea, inspectWorktreeContext, worktreeSnapshot } = ports;
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
  const context = inspectWorktreeContext(requestedRoot);
  const baseRecheckCommand = selector === undefined
    ? "silvermoon whats-next"
    : `silvermoon whats-next ${JSON.stringify(selector)}`;
  const recheckCommand = canonicalLanguage === undefined
    ? `${baseRecheckCommand} --audience agent`
    : `${baseRecheckCommand} --language ${canonicalLanguage} --audience agent`;
  type Outcome = { observation: Observation; responseContext: ResponseContext };
  let snapshot: SnapshotObservation | undefined;
  let repository: RepositoryReadiness | undefined;
  let selected: ReadyObservation["layout"]["ideas"][number] | null = null;
  let selectedIdea: IdeaSelectedObservation["selectedIdea"] | undefined;
  let outcome: Outcome | undefined;
  let deviceSample: Awaited<ReturnType<typeof observeDevice>> | undefined;
  let loader: ObjectiveLoader | undefined;
  let initialSample = true;
  const targetRoot = context.kind === "worktree" ? context.root : requestedRoot;
  const subject = { root: targetRoot, userHome: userHome ?? homedir() };
  function selectedSample() { return selected; }

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
  async function project() {
    const observed = await observeSnapshot({
      entryPath,
      outputLanguage: canonicalLanguage,
      root: targetRoot,
      userHome,
      version: { type: "worktree" },
      deviceObserver: async (options) => {
        deviceSample = await observeDevice(options);
        if (loader !== undefined) {
          const device = await loader.load(SILVERMOON_OBJECTIVE_URIS.device);
          const created = device.createInstance({
            subject: { userHome: subject.userHome },
            language: resolveContentTemplateLanguage(deviceSample.user.config?.preferredLanguage ?? "en-US").tag,
          });
          if (!created.ok) throw new ObjectiveOperationError(`Device instance creation failed: ${created.error.type}.`);
          await probeObjective(created.instance);
        }
        return deviceSample;
      },
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
  }
  const operations = {
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
  };
  const passed: CheckResult = { pass: true };
  function failed(id: string, parameters: JsonObject = {}): CheckResult {
    return { pass: false, problems: [{ id, parameters }] };
  }
  function observedProblems(problems: readonly { type: string; summary: string }[], state?: string): JsonObject {
    return {
      ...(state === undefined ? {} : { state }),
      problems: problems.map(({ type, summary }) => ({ type, summary })),
    };
  }
  function dynamicProblemSummary(parameters: JsonObject, fallback: string): string {
    const problems = parameters.problems;
    if (!Array.isArray(problems)) return fallback;
    const summaries = problems.flatMap((problem) =>
      typeof problem === "object" && problem !== null && !Array.isArray(problem)
        && typeof problem.type === "string" && typeof problem.summary === "string"
        ? [`${problem.type}: ${problem.summary}`]
        : []);
    return summaries.length === 0 ? fallback : summaries.join("\n");
  }
  function sampleDevice() {
    if (deviceSample === undefined) throw new ObjectiveOperationError("Device observation is unavailable.");
    return deviceSample;
  }
  function projectProblems(kind: "config" | "user" | "layout" | "adoption" | "schema"): CheckResult {
    if (snapshot === undefined) throw new ObjectiveOperationError("Project sample is unavailable.");
    if (snapshot.projectReady) return passed;
    const problems = snapshot.observation.problems;
    const category = (type: string) => {
      if (type.startsWith("user-")) return "user";
      if (type.includes("migration") || type.includes("runtime-upgrade") || type.includes("runtime-refresh")) return "schema";
      if (type.includes("git-") || type.includes("not-adopted") || type.includes("config-missing")) return "adoption";
      if (type.startsWith("idea-") || type.startsWith("layout-")) return "layout";
      return "config";
    };
    return problems.some(({ type }) => category(type) === kind)
      || (problems.length === 0 && kind === "config")
      ? failed("project", observedProblems(problems, snapshot.observation.state))
      : passed;
  }
  function repositoryProblems(types: readonly string[]): CheckResult {
    if (repository === undefined) throw new ObjectiveOperationError("Repository sample is unavailable.");
    if (repository.ready) return passed;
    const problems = repository.observation.problems;
    return problems.some(({ type }) => types.includes(type))
      ? failed("repository", {
        ...observedProblems(problems, repository.observation.state),
        root: repository.observation.root,
        head: repository.head ?? null,
        primary: repository.primary ?? null,
        branch: repository.branch === undefined ? null : {
          name: repository.branch.branch,
          remote: repository.branch.remote,
          repository: repository.branch.repository,
          upstreamBranch: repository.branch.upstreamBranch,
        },
      })
      : passed;
  }
  async function allGuidance(tree: string): Promise<CheckResult> {
    const observed = readySnapshot();
    const inspected = await guidanceInspector({ gitRoot: observed.observation.root, snapshotTree: tree });
    if (inspected.state === "invalid") {
      const base = repository?.ready ? repository.observation : observed.observation;
      finish(dialogueReadyObservation(base, "phase-guidance-invalid", {
        problems: inspected.diagnostics.map((diagnostic) => diagnosticProblem(diagnostic, observed.outputLanguage)),
      }), { nextSteps: phaseGuidanceInstructions(inspected.diagnostics, base.root, observed.outputLanguage, recheckCommand) });
      return failed("guidance", {
        problems: inspected.diagnostics.map(({ code, path }) => ({ type: code, summary: path })),
      });
    }
    return passed;
  }
  const lifecycleCheck = (phase: "ideal" | "inner" | "outer", acceptance: boolean): SilvermoonObjectiveCheck => async () => {
    if (selected === null) throw new ObjectiveOperationError("Selected Idea sample is unavailable.");
    const submission = selected.submissions?.[phase];
    const accepted = phase === "ideal"
      ? ["implementing", "deploying", "completed"].includes(selected.state)
      : phase === "inner" ? ["deploying", "completed"].includes(selected.state) : selected.state === "completed";
    const valid = acceptance ? accepted && (submission === undefined
      || (submission.state === "accepted" && submission.acceptedRevision === selected.revisions[submission.revision.field]))
      : submission === undefined
        ? accepted
        : (submission.state === "submitted" || submission.state === "accepted")
          && submission.revision.value === selected.revisions[submission.revision.field]
          && (submission.submittedRevision === submission.revision.value || submission.acceptedRevision === submission.revision.value);
    return valid ? passed : failed(phase, {
      lifecycleState: selected.state,
      phase,
      requirement: acceptance ? "accepted" : "submitted",
      revision: selected.revisions[phase === "ideal" ? "idealRevision"
        : phase === "inner" ? "implementationRevision" : "deploymentRevision"],
    });
  };
  loader = createSilvermoonObjectiveLoader({
    "device-config-valid": async () => sampleDevice().globalConfig.valid ? passed : failed("device-configuration", {
      configurationPath: sampleDevice().globalConfig.path,
    }),
    "device-runtime-linked": async () => {
      const device = sampleDevice();
      return device.runtime !== null && device.runtime.source !== "source-checkout" && device.runtime.version !== null
        ? passed : failed("device-runtime", {
          source: device.runtime?.source ?? null,
          version: device.runtime?.version ?? null,
        });
    },
    "device-skill-discoverable": async () => ["ready", "managed-by-host"].includes(sampleDevice().readiness?.skill.status ?? "")
      ? passed : failed("device-skill", { status: sampleDevice().readiness?.skill.status ?? null }),
    "device-update-current": async () => ["current", "managed-by-host"].includes(sampleDevice().readiness?.update.status ?? "")
      ? passed : failed("device-update", { status: sampleDevice().readiness?.update.status ?? null }),
    "project-config-valid": async () => {
      if (initialSample) initialSample = false;
      else await project();
      return projectProblems("config");
    },
    "project-user-config-valid": async () => projectProblems("user"),
    "project-layout-valid": async () => projectProblems("layout"),
    "project-adopted": async () => projectProblems("adoption"),
    "project-schema-ready": async () => projectProblems("schema"),
    "project-guidance-valid": async () => allGuidance(worktreeSnapshot(readySnapshot().observation.root).tree),
    "repository-worktree-clean": async () => {
      await operations.repository();
      return repositoryProblems(["worktree-conflicts", "worktree-changes", "worktree-inspection-failed"]);
    },
    "repository-head-present": async () => repositoryProblems(["head-missing"]),
    "repository-upstream-matches": async () => repositoryProblems(["detached-head", "primary-upstream-mismatch"]),
    "repository-primary-fetched": async () => repositoryProblems(["primary-fetch-failed"]),
    "repository-primary-aligned": async () => repositoryProblems(["primary-ahead", "primary-behind", "primary-diverged", "primary-ancestry-inspection-failed", "primary-history-incomplete"]),
    "repository-event-history-valid": async () => repositoryProblems(["idea.events.history-invalid"]),
    "project-primary-guidance-valid": async () => {
      const ready = readyRepository();
      if (ready.primary === undefined) throw new ObjectiveOperationError("Primary snapshot is unavailable.");
      return allGuidance(ready.primary);
    },
    "idea-metadata-valid": async (bound) => {
      const observed = readySnapshot();
      const prior = selectedSample();
      if (prior === null) throw new ObjectiveOperationError("Selected Idea is unavailable.");
      if (prior.id !== bound.ideaId) {
        finish(dialogueReadyObservation(readyRepository().observation, "repository-sync-required", {
          problems: [{ type: "worktree-changes", summary: "Idea selector changed during observation; reobserve before continuing." }],
        }), { nextSteps: recheckCommand });
        return failed("idea-configuration", { expectedIdeaId: bound.ideaId ?? null, observedIdeaId: prior.id });
      }
      const local = await observeIdea({ config: observed.config, root: observed.observation.root });
      const current = local.ideas.find(({ id }) => id === prior.id);
      if (local.diagnostics.length > 0 || current === undefined) {
        const problems = local.diagnostics.length > 0
          ? local.diagnostics.map((diagnostic) => diagnosticProblem(diagnostic, observed.outputLanguage))
          : [{ type: "idea-metadata-unavailable", summary: `Selected Idea ${prior.id} is no longer available.` }];
        const observation = { ...dialogueReadyObservation(observed.observation, "project-setup-required", { problems }), observedThrough: "ideas" as const };
        finish(observation, {
          nextSteps: projectInstructions({
            findings: local.diagnostics.map(({ remediation }) => ({ instruction: remediation })),
          }, observation.root, observed.outputLanguage, recheckCommand),
        });
        return failed("idea-configuration", observedProblems(problems));
      }
      if (JSON.stringify(current.revisions) !== JSON.stringify(prior.revisions) || current.eventDigest !== prior.eventDigest) {
        finish(dialogueReadyObservation(readyRepository().observation, "repository-sync-required", {
          problems: [{ type: "worktree-changes", summary: "Idea changed during observation; reobserve before navigating its new revision." }],
        }), { nextSteps: recheckCommand });
        return failed("repository", {
          reason: "idea-changed",
          ideaId: prior.id,
          primary: readyRepository().primary ?? null,
        });
      }
      selected = current;
      const selection = await operations.selection();
      if (!selection.passed) throw new ObjectiveOperationError("Idea instance routing has no selected object.");
      const guidance = await operations.guidance();
      if (!guidance.passed) return failed("guidance", { reason: "phase-guidance-changed" });
      return selected?.state === "abandoned"
        ? failed("idea-inactive", { ideaId: selected.id, lifecycleState: selected.state })
        : passed;
    },
    "idea-contracts-valid": async () => {
      if (selected === null || snapshot?.layout?.diagnostics.length !== 0) {
        return failed("idea-configuration", {
          ideaId: selected?.id ?? null,
          problems: (snapshot?.layout?.diagnostics ?? []).map(
            ({ code, path }) => ({ type: code, summary: path }),
          ),
        });
      }
      return passed;
    },
    "idea-ideal-submitted": lifecycleCheck("ideal", false),
    "idea-ideal-accepted": lifecycleCheck("ideal", true),
    "idea-inner-submitted": lifecycleCheck("inner", false),
    "idea-inner-accepted": lifecycleCheck("inner", true),
    "idea-outer-submitted": lifecycleCheck("outer", false),
    "idea-outer-accepted": lifecycleCheck("outer", true),
  });
  const fallbackOutputLanguage = resolveOutputLanguage({
    ...(canonicalLanguage === undefined ? {} : { override: canonicalLanguage }),
  }).tag;
  if (context.kind === "inspection-failed") {
    const observation: Observation = {
      state: "project-setup-required",
      root: context.root,
      outputLanguage: fallbackOutputLanguage,
      observedThrough: "root",
      problems: [{
        type: "git-worktree-inspection-failed",
        summary: context.message,
      }],
    };
    return runtime.complete(observation, {
      nextSteps: localize(
        fallbackOutputLanguage,
        `Repair Git worktree inspection for ${context.root}, then rerun ${recheckCommand}.`,
        `修复 ${context.root} 的 Git worktree 检查，然后重新运行 ${recheckCommand}。`,
      ),
    });
  }
  if (context.kind === "outside-worktree") {
    if (selector !== undefined) {
      const observation: Observation = {
        state: "project-setup-required",
        root: context.root,
        outputLanguage: fallbackOutputLanguage,
        observedThrough: "root",
        problems: [{
          type: "target-context-invalid",
          summary: localize(
            fallbackOutputLanguage,
            `Idea selector ${JSON.stringify(selector)} requires a Git worktree context.`,
            `Idea selector ${JSON.stringify(selector)} 需要 Git worktree 上下文。`,
          ),
        }],
      };
      return runtime.complete(observation, {
        nextSteps: localize(
          fallbackOutputLanguage,
          "Run the same command from the intended Git worktree.",
          "请从目标 Git worktree 中运行相同命令。",
        ),
      });
    }
    deviceSample = await observeDevice({
      ...(entryPath === undefined ? {} : { entryPath }),
      ...(userHome === undefined ? {} : { userHome }),
    });
    const outputLanguage = resolveOutputLanguage({
      ...(deviceSample.user.config?.preferredLanguage === undefined
        ? {}
        : { content: deviceSample.user.config.preferredLanguage }),
      ...(canonicalLanguage === undefined ? {} : { override: canonicalLanguage }),
    }).tag;
    const device = await loader.load(SILVERMOON_OBJECTIVE_URIS.device);
    const created = device.createInstance({
      subject: { userHome: subject.userHome },
      language: resolveContentTemplateLanguage(
        deviceSample.user.config?.preferredLanguage ?? "en-US",
      ).tag,
    });
    if (!created.ok) {
      throw new ObjectiveOperationError(`Device instance creation failed: ${created.error.type}.`);
    }
    const objective = await probeObjective(created.instance);
    const terminal = objective.position.level.id === "terminal";
    const problems = objective.position.problems.map(({ id, parameters }) => ({
      type: id,
      summary: dynamicProblemSummary(parameters, objective.gapSummary),
    }));
    const observation: ObjectiveReportObservation = {
      state: terminal ? "objective-ready" : "objective-blocked",
      root: context.root,
      outputLanguage,
      problems,
      ...(deviceSample.readiness === undefined ? {} : { device: deviceSample.readiness }),
      objective: { target: "device", level: objective.position.level.id, terminal },
    };
    return runtime.complete(observation, {
      nextSteps: terminal ? [] : [
        problems[0]?.summary ?? objective.gapSummary,
        recheckCommand,
      ],
    });
  }
  // Snapshot establishes routing and the content template language. Checks consume
  // this sample; no selector is represented as an Idea level.
  await project();
  const sample = snapshot;
  if (sample === undefined) throw new ObjectiveOperationError("Project observation omitted its sample.");
  const guideLanguage = resolveContentTemplateLanguage(sample.contentLanguage).tag;
  const routed = selectedSample();
  const scoped = routed?.state === "abandoned" ? null : routed;
  const guide = await loader.load(scoped === null ? SILVERMOON_OBJECTIVE_URIS.project : SILVERMOON_OBJECTIVE_URIS.idea);
  const created = guide.createInstance({
    subject: scoped === null ? subject : { ...subject, ideaId: scoped.id }, language: guideLanguage,
  });
  if (!created.ok) throw new ObjectiveOperationError(`Navigation instance creation failed: ${created.error.type}.`);
  const objective = await probeObjective(created.instance);
  if (scoped === null && objective.position.level.id === "terminal") {
    if (selector === undefined) {
      const observed = readySnapshot();
      const ready = readyRepository().observation;
      const terminalObservation: ObjectiveReportObservation = {
        state: "objective-ready",
        root: ready.root,
        version: ready.version,
        configuration: ready.configuration,
        ...(ready.device === undefined ? {} : { device: ready.device }),
        ...(ready.schemas === undefined ? {} : { schemas: ready.schemas }),
        outputLanguage: ready.outputLanguage,
        problems: ready.problems,
        objective: { target: "project", level: "terminal", terminal: true },
      };
      finish(terminalObservation, { nextSteps: [] });
      snapshot = observed;
    } else {
      await operations.selection();
      if (routed?.state === "abandoned") await operations.guidance();
    }
  }
  if (outcome === undefined) throw new TypeError("Navigation checks omitted the report.");
  return runtime.complete(outcome.observation, outcome.responseContext);
}

export async function whatsNext(options: WhatsNextOptions = {}) {
  return whatsNextUseCase(options);
}
