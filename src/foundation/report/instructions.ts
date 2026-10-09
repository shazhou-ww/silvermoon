import { diagnosticInstruction } from "./dialogue.ts";
import { resolveContentTemplateLanguage } from "../language/index.ts";
import {
  renderContentLanguage,
  renderEventAcceptGuidance,
  renderEventAppendCommand,
  renderEventInteractionGuidance,
  renderEventResumeGuidance,
  renderEventSubmitGuidance,
  renderLifecycleDeploying,
  renderLifecycleImplementing,
  renderLifecycleInactive,
  renderLifecyclePreparing,
  renderNavigationReady,
  renderPhaseGuidanceInvalid,
  renderPreparationSeed,
  renderProjectRecheck,
  renderRepositoryRecheck,
  renderReviewPresentation,
  renderReviewPresentationInstruction,
  renderWorktreeChangesStep,
  renderWorktreeConflictStep,
  renderWorktreeSummary,
} from "./templates/whats-next/index.ts";
import type {
  Diagnostic,
  IdeaReference,
  ReviewContext,
  ReviewPresentation,
} from "./types.ts";

export const CHANGE_SAMPLE_ITEM_LIMIT = 12;
export const CHANGE_SAMPLE_BYTE_LIMIT = 768;

/** @pure */
interface ChangedPath {
  path: string;
}

interface WorktreeChanges {
  conflicted: ChangedPath[];
  staged: ChangedPath[];
  unstaged: ChangedPath[];
  untracked: ChangedPath[];
}

interface IdeaWorld {
  documentPath: string;
  path: string;
}

interface LifecycleIdea extends IdeaReference {
  statusPath: string;
  idealRevision: string;
  worlds: {
    idealRevision: IdeaWorld;
    implementationRevision: IdeaWorld;
    deploymentRevision: IdeaWorld;
  };
  implementationRevision: string;
  deploymentRevision: string;
  ledgerPath: string;
  relativePath: string;
}

/** @pure */
function currentSubmission(idea: LifecycleIdea) {
  const current = idea.submissions?.current;
  return current === null || current === undefined
    ? undefined
    : idea.submissions?.[current];
}

/** @pure */
function reviewReady(idea: LifecycleIdea) {
  if (!idea.statusPath.endsWith("/events.jsonl")) return true;
  return currentSubmission(idea)?.state === "submitted"
    && idea.control?.owner === "upstream";
}

/** @pure */
export function ideaName(idea: Pick<IdeaReference, "id" | "alias">) {
  return idea.alias ?? idea.id;
}

/** @pure */
export function command(root: string, value: string) {
  return `\`${value.replace("<root>", root)}\``;
}

/** @pure */
export function joinInstructions(lines: Array<string | null | undefined | false>) {
  return lines.filter(Boolean).join("\n");
}

/** @pure */
export function formatInstructionSteps(steps: string[]) {
  return steps.length === 1
    ? steps
    : steps.map((step, index) => `${index + 1}. ${step}`);
}

/** @pure */
export function projectInstructions(
  observed: { findings: { instruction: string }[] },
  root: string,
  language: string,
  recheckCommand = "silvermoon whats-next",
) {
  return joinInstructions([
    ...formatInstructionSteps(observed.findings.map(({ instruction }) => instruction)),
    renderProjectRecheck(language, {
      recheckCommand: command(root, recheckCommand),
    }),
  ]);
}

/** @pure */
export function phaseGuidanceInstructions(
  diagnostics: Array<Diagnostic & { remediation: string }>,
  root: string,
  language: string,
  recheckCommand: string,
) {
  return joinInstructions([
    ...formatInstructionSteps(
      diagnostics.map((diagnostic) =>
        diagnosticInstruction(diagnostic, language)
      ),
    ),
    renderPhaseGuidanceInvalid(language, {
      recheckCommand: command(root, recheckCommand),
    }),
  ]);
}

/** @pure */
export function sampleChanges(changes: WorktreeChanges) {
  const entries = [
    ...changes.conflicted.map(({ path }) => `conflicted:${path}`),
    ...changes.staged.map(({ path }) => `staged:${path}`),
    ...changes.unstaged.map(({ path }) => `unstaged:${path}`),
    ...changes.untracked.map(({ path }) => `untracked:${path}`),
  ];
  const samples = [];
  let bytes = 0;
  for (const entry of entries) {
    if (samples.length >= CHANGE_SAMPLE_ITEM_LIMIT) break;
    const nextBytes = Buffer.byteLength(
      samples.length === 0 ? entry : `, ${entry}`,
      "utf8",
    );
    if (bytes + nextBytes > CHANGE_SAMPLE_BYTE_LIMIT) break;
    samples.push(entry);
    bytes += nextBytes;
  }
  return {
    counts: {
      conflicted: changes.conflicted.length,
      staged: changes.staged.length,
      unstaged: changes.unstaged.length,
      untracked: changes.untracked.length,
    },
    omitted: entries.length - samples.length,
    samples,
  };
}

/** @pure */
export function summarizeWorktreeChanges(changes: WorktreeChanges, language = "en-US") {
  const summary = sampleChanges(changes);
  return renderWorktreeSummary(language, summary);
}

/** @pure */
export function worktreeInstructionSteps(changes: WorktreeChanges, language: string) {
  const lines = [];
  if (changes.conflicted.length > 0) {
    lines.push(renderWorktreeConflictStep(language));
  }
  const hasOrdinaryChanges =
    changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  if (hasOrdinaryChanges) {
    lines.push(renderWorktreeChangesStep(language));
  }
  return lines;
}

/** @pure */
export function localRepositoryInstructions(
  root: string,
  steps: string[],
  language: string,
  recheckCommand: string,
) {
  return joinInstructions([
    ...formatInstructionSteps(steps),
    renderRepositoryRecheck(language, {
      recheckCommand: command(root, recheckCommand),
    }),
  ]);
}

/** @pure */
export function selectIdea<Idea extends IdeaReference>(
  ideas: Idea[],
  selector?: string,
): Idea | null {
  if (selector === undefined) return null;
  return ideas.find(({ id }) => id === selector)
    ?? ideas.find(({ alias }) => alias === selector)
    ?? null;
}

/** @pure */
export function lifecycleContentLanguageInstruction(contentLanguage: string, language: string) {
  return renderContentLanguage(language, { contentLanguage });
}

/** @pure */
function revisionReference(revision: string) {
  return revision.slice(0, 12);
}

/** @pure */
function reviewPresentation(
  phase: ReviewContext["phase"],
  revision: ReviewContext["revision"],
  contentLanguage: string,
): ReviewPresentation {
  const template = resolveContentTemplateLanguage(contentLanguage);
  const language = template.tag;
  const reference = `${revision.field}=${revisionReference(revision.value)}`;
  const text = renderReviewPresentation(language, {
    phase,
    reference,
  });
  return {
    contentLanguage,
    templateLanguage: template.tag,
    requiresLocalization: !template.localized,
    ...text,
  };
}

/** @pure */
export function lifecycleReview(
  idea: LifecycleIdea,
  primaryCommit: string,
  contentLanguage: string,
): ReviewContext | undefined {
  if (!reviewReady(idea)) return undefined;
  if (idea.state === "preparing") {
    const revision: ReviewContext["revision"] = {
      field: "idealRevision",
      value: idea.idealRevision,
    };
    return {
      phase: "preparing",
      decision: "acceptIdeal",
      revision,
      primaryCommit,
      scopePath: idea.worlds.idealRevision.path,
      canonicalDocuments: [
        {
          role: "current-contract",
          path: idea.worlds.idealRevision.documentPath,
        },
      ],
      presentation: reviewPresentation("preparing", revision, contentLanguage),
    };
  }
  if (idea.state === "implementing") {
    const revision: ReviewContext["revision"] = {
      field: "implementationRevision",
      value: idea.implementationRevision,
    };
    return {
      phase: "implementing",
      decision: "acceptInner",
      revision,
      primaryCommit,
      scopePath: idea.worlds.implementationRevision.path,
      canonicalDocuments: [
        {
          role: "current-contract",
          path: idea.worlds.implementationRevision.documentPath,
        },
        {
          role: "ledger",
          path: idea.ledgerPath,
        },
      ],
      presentation: reviewPresentation("implementing", revision, contentLanguage),
    };
  }
  if (idea.state === "deploying") {
    const revision: ReviewContext["revision"] = {
      field: "deploymentRevision",
      value: idea.deploymentRevision,
    };
    return {
      phase: "deploying",
      decision: "acceptOuter",
      revision,
      primaryCommit,
      scopePath: idea.worlds.deploymentRevision.path,
      canonicalDocuments: [
        {
          role: "current-contract",
          path: idea.worlds.deploymentRevision.documentPath,
        },
        {
          role: "ledger",
          path: idea.ledgerPath,
        },
      ],
      presentation: reviewPresentation("deploying", revision, contentLanguage),
    };
  }
  return undefined;
}

/** @pure */
function reviewPresentationInstruction(language: string) {
  return renderReviewPresentationInstruction(language);
}

/** @pure */
function preparationSeedInstruction(idea: LifecycleIdea, language: string) {
  return renderPreparationSeed(language, {
    deploymentDocumentPath: idea.worlds.deploymentRevision.documentPath,
    implementationDocumentPath: idea.worlds.implementationRevision.documentPath,
    ledgerPath: idea.ledgerPath,
  });
}

type EventPhaseGuidance = Readonly<{
  action: "acceptIdeal" | "acceptInner" | "acceptOuter";
  evidence: "Idea candidate" | "implementation evidence" | "external evidence";
  revisionField: "idealRevision" | "implementationRevision" | "deploymentRevision";
  revisionKind: "Idea" | "implementation" | "deployment";
  revisionReference: string;
  submitAction: "submitIdeal" | "submitInner" | "submitOuter";
}>;

/** @pure */
function eventGuidanceInstruction(
  idea: LifecycleIdea,
  language: string,
  phase: EventPhaseGuidance,
  primaryCommit: string,
) {
  const submission = currentSubmission(idea);
  const expectedDigest = idea.eventDigest ?? "<event-digest>";
  if (submission?.state === "submitted") {
    if (idea.control?.owner === "upstream") {
      return renderEventAcceptGuidance(language, {
        action: phase.action,
        appendCommand: renderEventAppendCommand(language, {
          audience: "agent",
          confirmDecision: true,
          expectedDigest,
          expectedPrimary: primaryCommit,
          ideaId: idea.id,
          inputPath: "request.json",
        }),
        revisionField: phase.revisionField,
        revisionKind: phase.revisionKind,
        revisionReference: phase.revisionReference,
        submitAction: phase.submitAction,
      });
    }
    return renderEventInteractionGuidance(language, {
      action: phase.action,
      appendCommand: renderEventAppendCommand(language, {
        audience: "agent",
        confirmDecision: false,
        expectedDigest,
        expectedPrimary: null,
        ideaId: idea.id,
        inputPath: "request.json",
      }),
      controlOwner: idea.control?.owner ?? null,
      revisionKind: phase.revisionKind,
      submitAction: phase.submitAction,
    });
  }
  return renderEventSubmitGuidance(language, {
    acceptanceAction: phase.action,
    action: phase.submitAction,
    appendCommand: renderEventAppendCommand(language, {
      audience: "agent",
      confirmDecision: false,
      expectedDigest,
      expectedPrimary: primaryCommit,
      ideaId: idea.id,
      inputPath: "request.json",
    }),
    controlOwner: idea.control?.owner ?? null,
    evidence: phase.evidence,
    revisionKind: phase.revisionKind,
    submissionState: submission?.state ?? null,
  });
}

/** @pure */
export function lifecycleInstruction(
  idea: LifecycleIdea,
  language: string,
  contentLanguage: string,
  primaryCommit: string,
) {
  const name = ideaName(idea);
  if (idea.statusPath.endsWith("/events.jsonl")) {
    const submission = currentSubmission(idea);
    const eventInstruction = idea.state === "preparing"
      ? eventGuidanceInstruction(idea, language, {
        action: "acceptIdeal",
        evidence: "Idea candidate",
        revisionField: "idealRevision",
        revisionKind: "Idea",
        revisionReference: revisionReference(idea.idealRevision),
        submitAction: "submitIdeal",
      }, primaryCommit)
      : idea.state === "implementing"
      ? eventGuidanceInstruction(idea, language, {
        action: "acceptInner",
        evidence: "implementation evidence",
        revisionField: "implementationRevision",
        revisionKind: "implementation",
        revisionReference: revisionReference(idea.implementationRevision),
        submitAction: "submitInner",
      }, primaryCommit)
      : idea.state === "deploying"
      ? eventGuidanceInstruction(idea, language, {
        action: "acceptOuter",
        evidence: "external evidence",
        revisionField: "deploymentRevision",
        revisionKind: "deployment",
        revisionReference: revisionReference(idea.deploymentRevision),
        submitAction: "submitOuter",
      }, primaryCommit)
      : renderEventResumeGuidance(language, {
        appendCommand: renderEventAppendCommand(language, {
          audience: "agent",
          confirmDecision: true,
          expectedDigest: idea.eventDigest ?? "<event-digest>",
          expectedPrimary: primaryCommit,
          ideaId: idea.id,
          inputPath: "request.json",
        }),
      });
    const instruction = idea.state === "preparing"
      ? renderLifecyclePreparing(language, {
        action: "acceptIdeal",
        documentPath: idea.worlds.idealRevision.documentPath,
        eventDigest: idea.eventDigest ?? null,
        eventBacked: true,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.idealRevision),
        statusPath: idea.statusPath,
        submissionState: submission?.state ?? null,
      })
      : idea.state === "implementing"
      ? renderLifecycleImplementing(language, {
        action: "acceptInner",
        documentPath: idea.worlds.implementationRevision.documentPath,
        eventDigest: idea.eventDigest ?? null,
        eventBacked: true,
        idealPath: idea.worlds.idealRevision.path,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.implementationRevision),
        statusPath: idea.statusPath,
        submissionState: submission?.state ?? null,
        worldPath: idea.worlds.implementationRevision.path,
      })
      : idea.state === "deploying"
      ? renderLifecycleDeploying(language, {
        action: "acceptOuter",
        documentPath: idea.worlds.deploymentRevision.documentPath,
        eventDigest: idea.eventDigest ?? null,
        eventBacked: true,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.deploymentRevision),
        statusPath: idea.statusPath,
        submissionState: submission?.state ?? null,
        worldPath: idea.worlds.deploymentRevision.path,
      })
      : renderLifecycleInactive(language, {
        eventBacked: true,
        name,
        relativePath: idea.relativePath,
        state: idea.state,
        statusPath: idea.statusPath,
      });
    return joinInstructions([
      instruction,
      eventInstruction,
      idea.state === "preparing" ? preparationSeedInstruction(idea, language) : null,
      idea.state === "preparing"
          || idea.state === "implementing"
          || idea.state === "deploying"
        ? reviewReady(idea) ? reviewPresentationInstruction(language) : null
        : null,
      lifecycleContentLanguageInstruction(contentLanguage, language),
    ]);
  }
  if (idea.state === "preparing") {
    return joinInstructions([
      renderLifecyclePreparing(language, {
        action: "acceptIdeal",
        documentPath: idea.worlds.idealRevision.documentPath,
        eventDigest: null,
        eventBacked: false,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.idealRevision),
        statusPath: idea.statusPath,
        submissionState: null,
      }),
      preparationSeedInstruction(idea, language),
      reviewPresentationInstruction(language),
      lifecycleContentLanguageInstruction(contentLanguage, language),
    ]);
  }
  if (idea.state === "implementing") {
    return joinInstructions([
      renderLifecycleImplementing(language, {
        action: "acceptInner",
        documentPath: idea.worlds.implementationRevision.documentPath,
        eventDigest: null,
        eventBacked: false,
        idealPath: idea.worlds.idealRevision.path,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.implementationRevision),
        statusPath: idea.statusPath,
        submissionState: null,
        worldPath: idea.worlds.implementationRevision.path,
      }),
      reviewPresentationInstruction(language),
      lifecycleContentLanguageInstruction(contentLanguage, language),
    ]);
  }
  if (idea.state === "deploying") {
    return joinInstructions([
      renderLifecycleDeploying(language, {
        action: "acceptOuter",
        documentPath: idea.worlds.deploymentRevision.documentPath,
        eventDigest: null,
        eventBacked: false,
        ledgerPath: idea.ledgerPath,
        name,
        primaryCommit,
        revisionReference: revisionReference(idea.deploymentRevision),
        statusPath: idea.statusPath,
        submissionState: null,
        worldPath: idea.worlds.deploymentRevision.path,
      }),
      reviewPresentationInstruction(language),
      lifecycleContentLanguageInstruction(contentLanguage, language),
    ]);
  }
  return renderLifecycleInactive(language, {
    eventBacked: false,
    name,
    relativePath: idea.relativePath,
    state: idea.state,
    statusPath: idea.statusPath,
  });
}

/** @pure */
export function navigationInstruction(ideas: Pick<IdeaReference, "state">[], language: string) {
  const hasActiveIdea = ideas.some(({ state }) =>
    state === "preparing" || state === "implementing" || state === "deploying"
  );
  return renderNavigationReady(language, { hasActiveIdea });
}
