import { isChinese } from "../../../language/index.ts";
import {
  contentLanguage as enContentLanguage,
  detachedHead as enDetachedHead,
  eventHistoryInvalid as enEventHistoryInvalid,
  eventAcceptGuidance as enEventAcceptGuidance,
  eventAppendCommand as enEventAppendCommand,
  eventInteractionGuidance as enEventInteractionGuidance,
  eventReplayCommand as enEventReplayCommand,
  eventResumeGuidance as enEventResumeGuidance,
  eventSubmitGuidance as enEventSubmitGuidance,
  headMissing as enHeadMissing,
  ideaMetadataUnavailable as enIdeaMetadataUnavailable,
  ideaNotFound as enIdeaNotFound,
  lifecycleDeploying as enLifecycleDeploying,
  lifecycleImplementing as enLifecycleImplementing,
  lifecycleInactive as enLifecycleInactive,
  lifecyclePreparing as enLifecyclePreparing,
  navigationReady as enNavigationReady,
  phaseGuidanceInvalid as enPhaseGuidanceInvalid,
  preparationSeed as enPreparationSeed,
  primaryAhead as enPrimaryAhead,
  primaryAncestryInspectionFailed as enPrimaryAncestryInspectionFailed,
  primaryBehind as enPrimaryBehind,
  primaryDiverged as enPrimaryDiverged,
  primaryFetchFailed as enPrimaryFetchFailed,
  primaryHistoryIncomplete as enPrimaryHistoryIncomplete,
  primaryUpstreamMismatch as enPrimaryUpstreamMismatch,
  projectRecheck as enProjectRecheck,
  repositoryRecheck as enRepositoryRecheck,
  reviewPresentation as enReviewPresentation,
  reviewPresentationInstruction as enReviewPresentationInstruction,
  worktreeChangesStep as enWorktreeChangesStep,
  worktreeConflicts as enWorktreeConflicts,
  worktreeConflictStep as enWorktreeConflictStep,
  worktreeInspectionFailed as enWorktreeInspectionFailed,
  worktreeSummary as enWorktreeSummary,
} from "./en-US/index.ts";
import {
  contentLanguage as zhContentLanguage,
  detachedHead as zhDetachedHead,
  eventHistoryInvalid as zhEventHistoryInvalid,
  eventAcceptGuidance as zhEventAcceptGuidance,
  eventAppendCommand as zhEventAppendCommand,
  eventInteractionGuidance as zhEventInteractionGuidance,
  eventReplayCommand as zhEventReplayCommand,
  eventResumeGuidance as zhEventResumeGuidance,
  eventSubmitGuidance as zhEventSubmitGuidance,
  headMissing as zhHeadMissing,
  ideaMetadataUnavailable as zhIdeaMetadataUnavailable,
  ideaNotFound as zhIdeaNotFound,
  lifecycleDeploying as zhLifecycleDeploying,
  lifecycleImplementing as zhLifecycleImplementing,
  lifecycleInactive as zhLifecycleInactive,
  lifecyclePreparing as zhLifecyclePreparing,
  navigationReady as zhNavigationReady,
  phaseGuidanceInvalid as zhPhaseGuidanceInvalid,
  preparationSeed as zhPreparationSeed,
  primaryAhead as zhPrimaryAhead,
  primaryAncestryInspectionFailed as zhPrimaryAncestryInspectionFailed,
  primaryBehind as zhPrimaryBehind,
  primaryDiverged as zhPrimaryDiverged,
  primaryFetchFailed as zhPrimaryFetchFailed,
  primaryHistoryIncomplete as zhPrimaryHistoryIncomplete,
  primaryUpstreamMismatch as zhPrimaryUpstreamMismatch,
  projectRecheck as zhProjectRecheck,
  repositoryRecheck as zhRepositoryRecheck,
  reviewPresentation as zhReviewPresentation,
  reviewPresentationInstruction as zhReviewPresentationInstruction,
  worktreeChangesStep as zhWorktreeChangesStep,
  worktreeConflicts as zhWorktreeConflicts,
  worktreeConflictStep as zhWorktreeConflictStep,
  worktreeInspectionFailed as zhWorktreeInspectionFailed,
  worktreeSummary as zhWorktreeSummary,
} from "./zh-CN/index.ts";
import type {
  ContentLanguageParameters,
  DetachedHeadParameters,
  EventHistoryInvalidParameters,
  EventAcceptGuidanceParameters,
  EventAppendCommandParameters,
  EventInteractionGuidanceParameters,
  EventReplayCommandParameters,
  EventResumeGuidanceParameters,
  EventSubmitGuidanceParameters,
  IdeaNotFoundParameters,
  LifecycleDeployingParameters,
  LifecycleImplementingParameters,
  LifecycleInactiveParameters,
  LifecyclePreparingParameters,
  MetadataUnavailableParameters,
  NavigationParameters,
  PreparationSeedParameters,
  PrimaryAncestryFailedParameters,
  PrimaryFetchFailedParameters,
  PrimaryRelationParameters,
  PrimaryUpstreamMismatchParameters,
  RecheckParameters,
  ReviewPresentationParameters,
  WorktreeConflictsParameters,
  WorktreeSummaryParameters,
} from "./contract.ts";

/** @pure */
export function renderProjectRecheck(
  language: string,
  parameters: RecheckParameters,
) {
  return isChinese(language)
    ? zhProjectRecheck(parameters)
    : enProjectRecheck(parameters);
}

/** @pure */
export function renderPhaseGuidanceInvalid(
  language: string,
  parameters: RecheckParameters,
) {
  return isChinese(language)
    ? zhPhaseGuidanceInvalid(parameters)
    : enPhaseGuidanceInvalid(parameters);
}

/** @pure */
export function renderWorktreeSummary(
  language: string,
  parameters: WorktreeSummaryParameters,
) {
  return isChinese(language)
    ? zhWorktreeSummary(parameters)
    : enWorktreeSummary(parameters);
}

/** @pure */
export function renderWorktreeConflictStep(language: string) {
  return isChinese(language)
    ? zhWorktreeConflictStep()
    : enWorktreeConflictStep();
}

/** @pure */
export function renderWorktreeChangesStep(language: string) {
  return isChinese(language)
    ? zhWorktreeChangesStep()
    : enWorktreeChangesStep();
}

/** @pure */
export function renderRepositoryRecheck(
  language: string,
  parameters: RecheckParameters,
) {
  return isChinese(language)
    ? zhRepositoryRecheck(parameters)
    : enRepositoryRecheck(parameters);
}

/** @pure */
export function renderContentLanguage(
  language: string,
  parameters: ContentLanguageParameters,
) {
  return isChinese(language)
    ? zhContentLanguage(parameters)
    : enContentLanguage(parameters);
}

/** @pure */
export function renderReviewPresentation(
  language: string,
  parameters: ReviewPresentationParameters,
) {
  return isChinese(language)
    ? zhReviewPresentation(parameters)
    : enReviewPresentation(parameters);
}

/** @pure */
export function renderReviewPresentationInstruction(language: string) {
  return isChinese(language)
    ? zhReviewPresentationInstruction()
    : enReviewPresentationInstruction();
}

/** @pure */
export function renderPreparationSeed(
  language: string,
  parameters: PreparationSeedParameters,
) {
  return isChinese(language)
    ? zhPreparationSeed(parameters)
    : enPreparationSeed(parameters);
}

/** @pure */
export function renderEventReplayCommand(
  language: string,
  parameters: EventReplayCommandParameters,
) {
  return isChinese(language)
    ? zhEventReplayCommand(parameters)
    : enEventReplayCommand(parameters);
}

/** @pure */
export function renderEventAppendCommand(
  language: string,
  parameters: EventAppendCommandParameters,
) {
  return isChinese(language)
    ? zhEventAppendCommand(parameters)
    : enEventAppendCommand(parameters);
}

/** @pure */
export function renderEventSubmitGuidance(
  language: string,
  parameters: EventSubmitGuidanceParameters,
) {
  return isChinese(language)
    ? zhEventSubmitGuidance(parameters)
    : enEventSubmitGuidance(parameters);
}

/** @pure */
export function renderEventAcceptGuidance(
  language: string,
  parameters: EventAcceptGuidanceParameters,
) {
  return isChinese(language)
    ? zhEventAcceptGuidance(parameters)
    : enEventAcceptGuidance(parameters);
}

/** @pure */
export function renderEventInteractionGuidance(
  language: string,
  parameters: EventInteractionGuidanceParameters,
) {
  return isChinese(language)
    ? zhEventInteractionGuidance(parameters)
    : enEventInteractionGuidance(parameters);
}

/** @pure */
export function renderEventResumeGuidance(
  language: string,
  parameters: EventResumeGuidanceParameters,
) {
  return isChinese(language)
    ? zhEventResumeGuidance(parameters)
    : enEventResumeGuidance(parameters);
}

/** @pure */
export function renderLifecyclePreparing(
  language: string,
  parameters: LifecyclePreparingParameters,
) {
  return isChinese(language)
    ? zhLifecyclePreparing(parameters)
    : enLifecyclePreparing(parameters);
}

/** @pure */
export function renderLifecycleImplementing(
  language: string,
  parameters: LifecycleImplementingParameters,
) {
  return isChinese(language)
    ? zhLifecycleImplementing(parameters)
    : enLifecycleImplementing(parameters);
}

/** @pure */
export function renderLifecycleDeploying(
  language: string,
  parameters: LifecycleDeployingParameters,
) {
  return isChinese(language)
    ? zhLifecycleDeploying(parameters)
    : enLifecycleDeploying(parameters);
}

/** @pure */
export function renderLifecycleInactive(
  language: string,
  parameters: LifecycleInactiveParameters,
) {
  return isChinese(language)
    ? zhLifecycleInactive(parameters)
    : enLifecycleInactive(parameters);
}

/** @pure */
export function renderNavigationReady(
  language: string,
  parameters: NavigationParameters,
) {
  return isChinese(language)
    ? zhNavigationReady(parameters)
    : enNavigationReady(parameters);
}

/** @pure */
export function renderIdeaNotFound(
  language: string,
  parameters: IdeaNotFoundParameters,
) {
  return isChinese(language)
    ? zhIdeaNotFound(parameters)
    : enIdeaNotFound(parameters);
}

/** @pure */
export function renderWorktreeConflicts(
  language: string,
  parameters: WorktreeConflictsParameters,
) {
  return isChinese(language)
    ? zhWorktreeConflicts(parameters)
    : enWorktreeConflicts(parameters);
}

/** @pure */
export function renderHeadMissing(language: string) {
  return isChinese(language) ? zhHeadMissing() : enHeadMissing();
}

/** @pure */
export function renderDetachedHead(
  language: string,
  parameters: DetachedHeadParameters,
) {
  return isChinese(language)
    ? zhDetachedHead(parameters)
    : enDetachedHead(parameters);
}

/** @pure */
export function renderPrimaryUpstreamMismatch(
  language: string,
  parameters: PrimaryUpstreamMismatchParameters,
) {
  return isChinese(language)
    ? zhPrimaryUpstreamMismatch(parameters)
    : enPrimaryUpstreamMismatch(parameters);
}

/** @pure */
export function renderWorktreeInspectionFailed(
  language: string,
  parameters: RecheckParameters,
) {
  return isChinese(language)
    ? zhWorktreeInspectionFailed(parameters)
    : enWorktreeInspectionFailed(parameters);
}

/** @pure */
export function renderPrimaryFetchFailed(
  language: string,
  parameters: PrimaryFetchFailedParameters,
) {
  return isChinese(language)
    ? zhPrimaryFetchFailed(parameters)
    : enPrimaryFetchFailed(parameters);
}

/** @pure */
export function renderPrimaryAncestryInspectionFailed(
  language: string,
  parameters: PrimaryAncestryFailedParameters,
) {
  return isChinese(language)
    ? zhPrimaryAncestryInspectionFailed(parameters)
    : enPrimaryAncestryInspectionFailed(parameters);
}

/** @pure */
export function renderEventHistoryInvalid(
  language: string,
  parameters: EventHistoryInvalidParameters,
) {
  return isChinese(language)
    ? zhEventHistoryInvalid(parameters)
    : enEventHistoryInvalid(parameters);
}

/** @pure */
export function renderPrimaryHistoryIncomplete(
  language: string,
  parameters: PrimaryRelationParameters,
) {
  return isChinese(language)
    ? zhPrimaryHistoryIncomplete(parameters)
    : enPrimaryHistoryIncomplete(parameters);
}

/** @pure */
export function renderPrimaryBehind(
  language: string,
  parameters: PrimaryRelationParameters,
) {
  return isChinese(language)
    ? zhPrimaryBehind(parameters)
    : enPrimaryBehind(parameters);
}

/** @pure */
export function renderPrimaryAhead(
  language: string,
  parameters: PrimaryRelationParameters,
) {
  return isChinese(language)
    ? zhPrimaryAhead(parameters)
    : enPrimaryAhead(parameters);
}

/** @pure */
export function renderPrimaryDiverged(
  language: string,
  parameters: PrimaryRelationParameters,
) {
  return isChinese(language)
    ? zhPrimaryDiverged(parameters)
    : enPrimaryDiverged(parameters);
}

/** @pure */
export function renderIdeaMetadataUnavailable(
  language: string,
  parameters: MetadataUnavailableParameters,
) {
  return isChinese(language)
    ? zhIdeaMetadataUnavailable(parameters)
    : enIdeaMetadataUnavailable(parameters);
}
