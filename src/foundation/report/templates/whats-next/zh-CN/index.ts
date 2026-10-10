import contentLanguage from "./content-language.ts";
import detachedHead from "./detached-head.ts";
import eventHistoryInvalid from "./event-history-invalid.ts";
import headMissing from "./head-missing.ts";
import ideaMetadataUnavailable from "./idea-metadata-unavailable.ts";
import ideaNotFound from "./idea-not-found.ts";
import lifecycleDeploying from "./lifecycle-deploying.ts";
import lifecycleImplementing from "./lifecycle-implementing.ts";
import lifecycleInactive from "./lifecycle-inactive.ts";
import lifecyclePreparing from "./lifecycle-preparing.ts";
import navigationReady from "./navigation-ready.ts";
import phaseGuidanceInvalid from "./phase-guidance-invalid.ts";
import preparationSeed from "./preparation-seed.ts";
import primaryAhead from "./primary-ahead.ts";
import primaryAncestryInspectionFailed from "./primary-ancestry-inspection-failed.ts";
import primaryBehind from "./primary-behind.ts";
import primaryDiverged from "./primary-diverged.ts";
import primaryFetchFailed from "./primary-fetch-failed.ts";
import primaryHistoryIncomplete from "./primary-history-incomplete.ts";
import primaryUpstreamMismatch from "./primary-upstream-mismatch.ts";
import projectRecheck from "./project-recheck.ts";
import repositoryRecheck from "./repository-recheck.ts";
import reviewPresentation from "./review-presentation.ts";
import reviewPresentationInstruction from "./review-presentation-instruction.ts";
import worktreeChangesStep from "./worktree-changes-step.ts";
import worktreeConflicts from "./worktree-conflicts.ts";
import worktreeConflictStep from "./worktree-conflict-step.ts";
import worktreeInspectionFailed from "./worktree-inspection-failed.ts";
import worktreeSummary from "./worktree-summary.ts";
import type { WhatsNextTemplates } from "../contract.ts";

const templates = {
  "project-recheck": projectRecheck,
  "phase-guidance-invalid": phaseGuidanceInvalid,
  "worktree-summary": worktreeSummary,
  "worktree-conflict-step": worktreeConflictStep,
  "worktree-changes-step": worktreeChangesStep,
  "repository-recheck": repositoryRecheck,
  "content-language": contentLanguage,
  "review-presentation": reviewPresentation,
  "review-presentation-instruction": reviewPresentationInstruction,
  "preparation-seed": preparationSeed,
  "lifecycle-preparing": lifecyclePreparing,
  "lifecycle-implementing": lifecycleImplementing,
  "lifecycle-deploying": lifecycleDeploying,
  "lifecycle-inactive": lifecycleInactive,
  "navigation-ready": navigationReady,
  "idea-not-found": ideaNotFound,
  "worktree-conflicts": worktreeConflicts,
  "head-missing": headMissing,
  "detached-head": detachedHead,
  "primary-upstream-mismatch": primaryUpstreamMismatch,
  "worktree-inspection-failed": worktreeInspectionFailed,
  "primary-fetch-failed": primaryFetchFailed,
  "primary-ancestry-inspection-failed": primaryAncestryInspectionFailed,
  "event-history-invalid": eventHistoryInvalid,
  "primary-history-incomplete": primaryHistoryIncomplete,
  "primary-behind": primaryBehind,
  "primary-ahead": primaryAhead,
  "primary-diverged": primaryDiverged,
  "idea-metadata-unavailable": ideaMetadataUnavailable,
} satisfies WhatsNextTemplates;

export default templates;

export {
  contentLanguage,
  detachedHead,
  eventHistoryInvalid,
  headMissing,
  ideaMetadataUnavailable,
  ideaNotFound,
  lifecycleDeploying,
  lifecycleImplementing,
  lifecycleInactive,
  lifecyclePreparing,
  navigationReady,
  phaseGuidanceInvalid,
  preparationSeed,
  primaryAhead,
  primaryAncestryInspectionFailed,
  primaryBehind,
  primaryDiverged,
  primaryFetchFailed,
  primaryHistoryIncomplete,
  primaryUpstreamMismatch,
  projectRecheck,
  repositoryRecheck,
  reviewPresentation,
  reviewPresentationInstruction,
  worktreeChangesStep,
  worktreeConflicts,
  worktreeConflictStep,
  worktreeInspectionFailed,
  worktreeSummary,
};
