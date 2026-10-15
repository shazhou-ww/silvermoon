import { resolve } from "node:path";
import { homedir } from "node:os";

import {
  createSilvermoonObjectiveLoader, probeObjective, SILVERMOON_OBJECTIVE_URIS,
} from "./objective-guides.ts";
import type { SilvermoonObjectiveCheck } from "./objective-guides.ts";
import { ObjectiveOperationError } from "../objective-guide/index.ts";
import type { CheckResult, ObjectiveLoader } from "../objective-guide/index.ts";
import type { ObjectiveGuideInstance, ObjectiveObservation } from "../objective-guide/index.ts";
import type { JsonObject } from "../objective-guide/index.ts";
import { inspectWorktreeContext, worktreeSnapshot } from "../foundation/git/index.ts";
import { ideaInventoryItem } from "../foundation/idea-query/index.ts";
import { observeDevice, observeIdea } from "./shared/index.ts";
import { createCommandRun } from "../foundation/command-message/index.ts";
import { ACTIVE_STATES, diagnosticProblem, dialogueReadyObservation } from "../foundation/report/index.ts";
import { inspectAllGuidance, inspectPhaseGuidance } from "../foundation/guidance/index.ts";
import { canonicalizeOutputLanguage, localize, resolveOutputLanguage } from "../foundation/language/index.ts";
import { observeSnapshot, withObservationLanguage } from "./shared/index.ts";

import { joinInstructions, lifecycleInstruction, lifecycleReview, phaseGuidanceInstructions, projectInstructions, renderIdeaNotFound, selectIdea } from "../foundation/report/index.ts";
import {
  objectiveReferenceCommand,
  objectiveReferenceLookup,
  renderObjectiveReferenceContent,
} from "./objective-reference.ts";
import { assessRepositoryReadiness } from "./shared/index.ts";
import type { Diagnostic, ReadyObservation, RepositoryReadiness, SnapshotObservation } from "./shared/business-types.ts";
import type {
  IdeaNotFoundObservation,
  IdeaSelectedObservation,
  NavigationReadyObservation,
  ObjectiveObservation as ObjectiveReportObservation,
  ObjectiveProjection,
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

type ObjectiveId = ObjectiveProjection["target"];

function objectiveId(instance: ObjectiveGuideInstance): ObjectiveId {
  const match = Object.entries(SILVERMOON_OBJECTIVE_URIS).find(
    ([, uri]) => uri === instance.guide.manifestUri,
  );
  if (match === undefined) {
    throw new ObjectiveOperationError(
      `Unknown bundled Objective: ${instance.guide.manifestUri}.`,
    );
  }
  return match[0] as ObjectiveId;
}

async function objectiveProjection(
  target: ObjectiveId,
  observation: ObjectiveObservation,
): Promise<ObjectiveProjection> {
  const { position } = observation;
  const owner = objectiveId(position.owner);
  const pageIds = [
    ...(position.level.id === "terminal" || owner !== "device"
      ? [{ kind: "level" as const, id: `levels/${position.level.id}` }]
      : []),
    ...(position.failingCheck === null
      ? []
      : [{ kind: "check" as const, id: `checks/${position.failingCheck}` }]),
    ...position.problems.map(({ id }) => ({
      kind: "problem" as const,
      id: `problems/${id}`,
    })),
  ];
  const references = await Promise.all(pageIds.map(async ({ kind, id }) => {
    const page = await position.owner.readPage(id);
    return {
      kind,
      id,
      owner,
      lookup: objectiveReferenceLookup(id),
      title: page.title,
      ...(page.description === undefined
        ? {}
        : { description: page.description }),
      ...(page.outcome === undefined ? {} : { outcome: page.outcome }),
      ...(page.instruction === undefined
        ? {}
        : { instruction: page.instruction }),
      content: renderObjectiveReferenceContent(
        page.content,
        owner,
        position.owner.language,
      ),
      command: objectiveReferenceCommand(owner, id, position.owner.language),
    };
  }));
  return {
    target,
    owner,
    level: position.level.id,
    failingCheck: position.failingCheck,
    terminal: position.level.id === "terminal",
    problems: position.problems.map(({ id, parameters }) => ({
      id,
      parameters,
    })),
    references,
  };
}

function firstObjectiveInstruction(
  objective: ObjectiveProjection,
  fallback: string,
) {
  const problem = objective.problems[0];
  if (problem === undefined) return fallback;
  const reference = objective.references.find(
    ({ id, kind }) => kind === "problem" && id === `problems/${problem.id}`,
  );
  return reference?.instruction ?? reference?.description ?? fallback;
}

function objectiveRecheckInstruction(language: string, command: string) {
  return localize(
    language,
    `Use \`${command}\` to verify the resulting Objective state.`,
    `完成调整后，用 \`${command}\` 验证 Objective 状态。`,
  );
}

function projectReadyInstruction(language: string) {
  return localize(
    language,
    "Project readiness is complete. The next goal is to choose the Idea to advance: possible methods are to inspect active Ideas with `silvermoon list-ideas`, then run `silvermoon whats-next <ULID-or-alias>` for the selected one. If no existing Idea matches genuinely new work, `silvermoon create-idea` is another path.",
    "项目整备已经完成。下一目标是选择要推进的 Idea：可先用 `silvermoon list-ideas` 查看 active Ideas，再对所选对象运行 `silvermoon whats-next <ULID-or-alias>`。如果确实是没有匹配既有 Idea 的新工作，`silvermoon create-idea` 也是一种路径。",
  );
}

function objectiveProblems(observation: ObjectiveObservation) {
  return observation.position.problems.map(({ id }) => ({
    type: id,
    summary: observation.gapSummary,
  }));
}

function objectiveReport(
  source: Observation,
  objective: ObjectiveProjection,
  problems: ReturnType<typeof objectiveProblems>,
): ObjectiveReportObservation {
  return {
    state: objective.terminal ? "objective-ready" : "objective-blocked",
    root: source.root,
    outputLanguage: source.outputLanguage,
    problems,
    ...(source.device === undefined ? {} : { device: source.device }),
    ...(source.version === undefined ? {} : { version: source.version }),
    ...(source.configuration === undefined
      ? {}
      : { configuration: source.configuration }),
    ...(source.schemas === undefined ? {} : { schemas: source.schemas }),
    objective,
  };
}

const WHATSNEXT_PORTS = Object.freeze({ createCommandRun, observeSnapshot, assessRepositoryReadiness, createSilvermoonObjectiveLoader, probeObjective, observeDevice, observeIdea, inspectWorktreeContext, worktreeSnapshot });

function navigationSource(
  observation: ProjectReadyObservation,
): ProjectReadyObservation & { ideas: NonNullable<ProjectReadyObservation["ideas"]> } {
  if (observation.ideas === undefined) {
    throw new TypeError("Ready project observation omitted its idea summary.");
  }
  return { ...observation, ideas: observation.ideas };
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
  const { createCommandRun, observeSnapshot, assessRepositoryReadiness, createSilvermoonObjectiveLoader, probeObjective, observeDevice, observeIdea, inspectWorktreeContext, worktreeSnapshot } = ports;
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
          activeIdeas: readyObservation.ideas.activeIdeas.map((idea) =>
            ideaInventoryItem(idea)
          ),
        },
      };
      if (selector === undefined) {
        throw new TypeError("Bare navigation must terminate at the Project Objective.");
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
        ...(selected.gateModes === undefined
          ? {}
          : { gateModes: selected.gateModes }),
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
  function observedProblemTypes(problems: readonly { type: string }[]): readonly string[] {
    return problems.map(({ type }) => type);
  }
  function observedProblemFacts(
    problems: readonly { type: string }[],
    state?: string,
  ): JsonObject {
    return {
      ...(state === undefined ? {} : { state }),
      problemTypes: observedProblemTypes(problems),
    };
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
      ? failed("project", observedProblemFacts(problems, snapshot.observation.state))
      : passed;
  }
  function repositoryProblems(types: readonly string[]): CheckResult {
    if (repository === undefined) throw new ObjectiveOperationError("Repository sample is unavailable.");
    if (snapshot?.config === null || snapshot?.config === undefined) {
      throw new ObjectiveOperationError("Project configuration is unavailable.");
    }
    if (repository.ready) return passed;
    const problems = repository.observation.problems;
    return problems.some(({ type }) => types.includes(type))
      ? failed("repository", {
        ...observedProblemFacts(problems, repository.observation.state),
        root: repository.observation.root,
        head: repository.head ?? null,
        primary: repository.primary ?? null,
        expectedRepository: snapshot.config.primaryRepository,
        expectedBranch: snapshot.config.primaryBranch,
        branch: repository.branch === undefined ? null : {
          name: repository.branch.branch,
          remote: repository.branch.remote,
          repository: repository.branch.repository,
          upstreamBranch: repository.branch.upstreamBranch,
        },
        ...(repository.changes === undefined
          ? {}
          : {
            changes: {
              conflicted: repository.changes.conflicted.map(({ path }) => path),
              staged: repository.changes.staged.map(({ path }) => path),
              unstaged: repository.changes.unstaged.map(({ path }) => path),
              untracked: repository.changes.untracked.map(({ path }) => path),
            },
          }),
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
        diagnostics: inspected.diagnostics.map(({ code, path }) => ({ code, path })),
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
      || ((submission.state === "accepted"
        && submission.acceptedRevision === selected.revisions[submission.revision.field])
        || (submission.state === "waived"
          && submission.waivedRevision === selected.revisions[submission.revision.field])))
      : submission === undefined
        ? accepted
        : (submission.state === "submitted"
          || submission.state === "accepted"
          || submission.state === "waived")
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
    "device-config-valid": async () => {
      const device = sampleDevice();
      return device.globalConfig.valid ? passed : failed("device-configuration", {
        configurationPath: device.globalConfig.path,
        diagnosticCodes: device.diagnostics.flatMap(({ code }) =>
          code === undefined ? [] : [code]
        ),
      });
    },
    "device-runtime-linked": async () => {
      const device = sampleDevice();
      return device.runtime !== null && device.runtime.source !== "source-checkout" && device.runtime.version !== null
        ? passed : failed("device-runtime", {
          runtimePath: device.runtime?.entry ?? null,
          source: device.runtime?.source ?? null,
          version: device.runtime?.version ?? null,
          ...(device.runtime?.source === "source-checkout"
            ? { checkoutPath: device.runtime.packageRoot }
            : {}),
        });
    },
    "device-skill-discoverable": async () => {
      const skill = sampleDevice().readiness?.skill;
      return ["ready", "managed-by-host"].includes(skill?.status ?? "")
        ? passed
        : failed("device-skill", {
          status: skill?.status ?? null,
          expectedRoot: skill?.expectedRoot ?? null,
          paths: skill?.paths ?? [],
        });
    },
    "device-update-current": async () => {
      const update = sampleDevice().readiness?.update;
      return ["current", "not-required", "managed-by-host"].includes(update?.status ?? "")
        ? passed
        : failed("device-update", {
          status: update?.status ?? null,
          currentVersion: update?.currentVersion ?? null,
          latestVersion: update !== undefined && "latestVersion" in update
            ? update.latestVersion ?? null
            : null,
          channel: update !== undefined && "channel" in update
            ? update.channel ?? null
            : null,
        });
    },
    "project-config-valid": async () => {
      if (initialSample) initialSample = false;
      else await project();
      return projectProblems("config");
    },
    "project-user-config-valid": async () => projectProblems("user"),
    "project-layout-valid": async () => projectProblems("layout"),
    "project-adopted": async () => projectProblems("adoption"),
    "project-schema-ready": async () => projectProblems("schema"),
    "project-guidance-valid": async () => {
      if (snapshot === undefined) throw new ObjectiveOperationError("Project sample is unavailable.");
      if (!snapshot.projectReady) {
        return failed("project", { ...observedProblemFacts(snapshot.observation.problems, snapshot.observation.state),
          prerequisite: "project-ready" });
      }
      return allGuidance(worktreeSnapshot(snapshot.observation.root).tree);
    },
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
      if (repository === undefined) throw new ObjectiveOperationError("Repository sample is unavailable.");
      if (!repository.ready) {
        return failed("repository", { ...observedProblemFacts(repository.observation.problems, repository.observation.state),
          prerequisite: "repository-ready" });
      }
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
        return failed("idea-configuration", observedProblemFacts(problems));
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
          diagnostics: (snapshot?.layout?.diagnostics ?? []).map(
            ({ code, path }) => ({ code, path }),
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
      language: outputLanguage,
    });
    if (!created.ok) {
      throw new ObjectiveOperationError(`Device instance creation failed: ${created.error.type}.`);
    }
    const objective = await probeObjective(created.instance);
    const projectedObjective = await objectiveProjection("device", objective);
    const problems = objectiveProblems(objective);
    const observation: ObjectiveReportObservation = {
      state: projectedObjective.terminal ? "objective-ready" : "objective-blocked",
      root: context.root,
      outputLanguage,
      problems,
      ...(deviceSample.readiness === undefined ? {} : { device: deviceSample.readiness }),
      objective: projectedObjective,
    };
    return runtime.complete(observation, {
      nextSteps: projectedObjective.terminal ? [] : [
        firstObjectiveInstruction(
          projectedObjective,
          problems[0]?.summary ?? objective.gapSummary,
        ),
        objectiveRecheckInstruction(objective.position.owner.language, recheckCommand),
      ],
    });
  }
  // Snapshot establishes routing and the content template language. Checks consume
  // this sample; no selector is represented as an Idea level.
  await project();
  const sample = snapshot;
  if (sample === undefined) throw new ObjectiveOperationError("Project observation omitted its sample.");
  const guideLanguage = sample.outputLanguage;
  const routed = selectedSample();
  const scoped = routed?.state === "abandoned" ? null : routed;
  const guide = await loader.load(scoped === null ? SILVERMOON_OBJECTIVE_URIS.project : SILVERMOON_OBJECTIVE_URIS.idea);
  const created = guide.createInstance({
    subject: scoped === null ? subject : { ...subject, ideaId: scoped.id }, language: guideLanguage,
  });
  if (!created.ok) throw new ObjectiveOperationError(`Navigation instance creation failed: ${created.error.type}.`);
  const objective = await probeObjective(created.instance);
  const projectedObjective = await objectiveProjection(
    selector === undefined ? "project" : "idea",
    objective,
  );
  if (projectedObjective.owner === "device") {
    const problems = objectiveProblems(objective);
    return runtime.complete(
      objectiveReport(sample.observation, projectedObjective, problems),
      {
        nextSteps: [
          firstObjectiveInstruction(
            projectedObjective,
            problems[0]?.summary ?? objective.gapSummary,
          ),
          objectiveRecheckInstruction(objective.position.owner.language, recheckCommand),
        ],
      },
    );
  }
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
        objective: await objectiveProjection("project", objective),
      };
      finish(terminalObservation, {
        nextSteps: [projectReadyInstruction(guideLanguage)],
      });
      snapshot = observed;
    } else {
      await operations.selection();
      if (routed?.state === "abandoned") await operations.guidance();
    }
  }
  if (outcome === undefined) throw new TypeError("Navigation checks omitted the report.");
  const isExplicitMiss = outcome.observation.state === "idea-not-found";
  return runtime.complete(
    isExplicitMiss
      ? outcome.observation
      : { ...outcome.observation, objective: projectedObjective } as Observation,
    outcome.responseContext,
  );
}

export async function whatsNext(options: WhatsNextOptions = {}) {
  return whatsNextUseCase(options);
}
