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
  "lifecycle-prepared",
  "lifecycle-implementing",
  "lifecycle-implemented",
  "lifecycle-deploying",
  "lifecycle-deployed",
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

interface LifecycleCurrentParameters {
  action: string;
  controlOwner: "upstream" | "downstream" | "none" | null;
  documentPath: string;
  ideaId: string;
  ledgerPath: string;
  name: string;
  submissionState: "unsubmitted" | "accepted" | "stale" | null;
  submitAction: string;
}

interface LifecycleSubmittedParameters {
  action: string;
  controlOwner: "upstream" | "downstream" | "none" | null;
  ideaId: string;
  revisionReference: string;
  submitAction: string;
}

export interface LifecyclePreparingParameters extends LifecycleCurrentParameters {}

export interface LifecyclePreparedParameters extends LifecycleSubmittedParameters {}

export interface LifecycleImplementingParameters extends LifecycleCurrentParameters {
  idealPath: string;
  worldPath: string;
}

export interface LifecycleImplementedParameters extends LifecycleSubmittedParameters {}

export interface LifecycleDeployingParameters extends LifecycleCurrentParameters {
  worldPath: string;
}

export interface LifecycleDeployedParameters extends LifecycleSubmittedParameters {}

export interface LifecycleInactiveParameters {
  name: string;
  state: string;
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

export interface SummaryAndNextSteps {
  nextSteps: string;
  summary: string;
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

export interface MetadataUnavailableParameters {
  command: string;
  documentPath?: string;
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
  "lifecycle-prepared": (
    parameters: LifecyclePreparedParameters,
  ) => string;
  "lifecycle-implementing": (
    parameters: LifecycleImplementingParameters,
  ) => string;
  "lifecycle-implemented": (
    parameters: LifecycleImplementedParameters,
  ) => string;
  "lifecycle-deploying": (
    parameters: LifecycleDeployingParameters,
  ) => string;
  "lifecycle-deployed": (
    parameters: LifecycleDeployedParameters,
  ) => string;
  "lifecycle-inactive": (
    parameters: LifecycleInactiveParameters,
  ) => string;
  "navigation-ready": (parameters: NavigationParameters) => string;
  "idea-not-found": (parameters: IdeaNotFoundParameters) => string;
  "worktree-conflicts": (
    parameters: WorktreeConflictsParameters,
  ) => string;
  "head-missing": () => SummaryAndNextSteps;
  "detached-head": (
    parameters: DetachedHeadParameters,
  ) => SummaryAndNextSteps;
  "primary-upstream-mismatch": (
    parameters: PrimaryUpstreamMismatchParameters,
  ) => SummaryAndNextSteps;
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
  ) => SummaryAndNextSteps;
  "primary-behind": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndNextSteps;
  "primary-ahead": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndNextSteps;
  "primary-diverged": (
    parameters: PrimaryRelationParameters,
  ) => SummaryAndNextSteps;
  "idea-metadata-unavailable": (
    parameters: MetadataUnavailableParameters,
  ) => SummaryAndNextSteps;
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
