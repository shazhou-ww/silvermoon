import type {
  ReviewContext,
  ReviewPresentation,
} from "../../types.ts";

export const WHATS_NEXT_TEMPLATE_IDS = Object.freeze([
  "project-recheck",
  "phase-guidance-invalid",
  "worktree-summary",
  "worktree-conflict-step",
  "worktree-changes-step",
  "repository-recheck",
  "content-language",
  "review-presentation",
  "review-presentation-instruction",
  "preparation-seed",
  "lifecycle-preparing",
  "lifecycle-implementing",
  "lifecycle-deploying",
  "lifecycle-inactive",
  "navigation-ready",
  "idea-not-found",
  "worktree-conflicts",
  "head-missing",
  "detached-head",
  "primary-upstream-mismatch",
  "worktree-inspection-failed",
  "primary-fetch-failed",
  "primary-ancestry-inspection-failed",
  "event-history-invalid",
  "primary-history-incomplete",
  "primary-behind",
  "primary-ahead",
  "primary-diverged",
  "idea-metadata-unavailable",
] as const);

export interface RecheckParameters {
  recheckCommand: string;
}

export interface WorktreeSummaryParameters {
  counts: {
    conflicted: number;
    staged: number;
    unstaged: number;
    untracked: number;
  };
  omitted: number;
  samples: string[];
}

export interface ContentLanguageParameters {
  contentLanguage: string;
}

export interface ReviewPresentationParameters {
  phase: ReviewContext["phase"];
  reference: string;
}

export type ReviewPresentationText = Omit<
  ReviewPresentation,
  "contentLanguage" | "templateLanguage" | "requiresLocalization"
>;

export interface PreparationSeedParameters {
  implementationDocumentPath: string;
  deploymentDocumentPath: string;
  ledgerPath: string;
}

interface LifecycleParameters {
  action: string;
  controlOwner: "upstream" | "downstream" | "none" | null;
  documentPath: string;
  eventBacked: boolean;
  ideaId: string;
  ledgerPath: string;
  name: string;
  revisionReference: string;
  statusPath: string;
  submissionState: "unsubmitted" | "submitted" | "accepted" | "stale" | null;
  submitAction: string;
}

export interface LifecyclePreparingParameters extends LifecycleParameters {}

export interface LifecycleImplementingParameters extends LifecycleParameters {
  idealPath: string;
  worldPath: string;
}

export interface LifecycleDeployingParameters extends LifecycleParameters {
  worldPath: string;
}

export interface LifecycleInactiveParameters {
  eventBacked: boolean;
  name: string;
  relativePath: string;
  state: string;
  statusPath: string;
}

export interface NavigationParameters {
  hasActiveIdea: boolean;
}

export interface IdeaNotFoundParameters {
  selector: string;
}

export interface WorktreeConflictsParameters {
  count: number;
  summary: string;
}

export interface SummaryAndStep {
  summary: string;
  step: string;
}

export interface DetachedHeadParameters {
  expectedBranch: string;
  expectedRepository: string;
  head: string | null;
}

export interface PrimaryUpstreamMismatchParameters {
  branch: string;
  expectedBranch: string;
  expectedRepository: string;
  remote: string | null;
  repository: string | null;
  upstreamBranch: string | null;
  verifyCommand: string;
}

export interface PrimaryFetchFailedParameters extends RecheckParameters {
  primaryBranch: string;
  primaryRepository: string;
}

export interface PrimaryAncestryFailedParameters extends RecheckParameters {
  head: string;
  primary: string;
}

export interface EventHistoryInvalidParameters {
  recheckCommand: string;
}

export interface PrimaryRelationParameters extends RecheckParameters {
  branch: string | null;
  head: string;
  mergeCommand: string;
  primary: string;
  remote: string | null;
  primaryBranch: string;
}

export interface SummaryAndInstructions {
  instructions: string;
  summary: string;
}

export interface MetadataUnavailableParameters {
  command: string;
  message: string;
}

export interface WhatsNextTemplates {
  "project-recheck": (parameters: RecheckParameters) => string;
  "phase-guidance-invalid": (parameters: RecheckParameters) => string;
  "worktree-summary": (parameters: WorktreeSummaryParameters) => string;
  "worktree-conflict-step": () => string;
  "worktree-changes-step": () => string;
  "repository-recheck": (parameters: RecheckParameters) => string;
  "content-language": (parameters: ContentLanguageParameters) => string;
  "review-presentation": (
    parameters: ReviewPresentationParameters,
  ) => ReviewPresentationText;
  "review-presentation-instruction": () => string;
  "preparation-seed": (
    parameters: PreparationSeedParameters,
  ) => string;
  "lifecycle-preparing": (
    parameters: LifecyclePreparingParameters,
  ) => string;
  "lifecycle-implementing": (
    parameters: LifecycleImplementingParameters,
  ) => string;
  "lifecycle-deploying": (
    parameters: LifecycleDeployingParameters,
  ) => string;
  "lifecycle-inactive": (
    parameters: LifecycleInactiveParameters,
  ) => string;
  "navigation-ready": (parameters: NavigationParameters) => string;
  "idea-not-found": (parameters: IdeaNotFoundParameters) => string;
  "worktree-conflicts": (
    parameters: WorktreeConflictsParameters,
  ) => string;
  "head-missing": () => SummaryAndStep;
  "detached-head": (
    parameters: DetachedHeadParameters,
  ) => SummaryAndStep;
  "primary-upstream-mismatch": (
    parameters: PrimaryUpstreamMismatchParameters,
  ) => SummaryAndStep;
  "worktree-inspection-failed": (
    parameters: RecheckParameters,
  ) => string;
  "primary-fetch-failed": (
    parameters: PrimaryFetchFailedParameters,
  ) => string;
  "primary-ancestry-inspection-failed": (
    parameters: PrimaryAncestryFailedParameters,
  ) => string;
  "event-history-invalid": (
    parameters: EventHistoryInvalidParameters,
  ) => string;
  "primary-history-incomplete": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndInstructions;
  "primary-behind": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndInstructions;
  "primary-ahead": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndInstructions;
  "primary-diverged": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndInstructions;
  "idea-metadata-unavailable": (
    parameters: MetadataUnavailableParameters,
  ) => {
    nextSteps: string;
    summary: string;
  };
}

type MissingTemplateIds = Exclude<
  typeof WHATS_NEXT_TEMPLATE_IDS[number],
  keyof WhatsNextTemplates
>;
type ExtraTemplateIds = Exclude<
  keyof WhatsNextTemplates,
  typeof WHATS_NEXT_TEMPLATE_IDS[number]
>;
const templateIdsCoverContract:
  MissingTemplateIds extends never
    ? ExtraTemplateIds extends never ? true : never
    : never = true;
void templateIdsCoverContract;
