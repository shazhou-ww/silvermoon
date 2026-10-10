import {
  command,
  localRepositoryInstructions,
  renderDetachedHead,
  renderHeadMissing,
  renderPrimaryUpstreamMismatch,
  renderWorktreeConflicts,
  summarizeWorktreeChanges,
  worktreeInstructionSteps,
} from "../../foundation/report/index.ts";
import type {
  ReadyObservation,
  RepositoryReadiness,
  RepositoryState,
} from "./business-types.ts";
import { repositoryProblem } from "./business-types.ts";

/** @pure */
export function evaluateLocalReadiness({
  repository,
  observed,
  root,
  recheckCommand,
}: {
  repository: RepositoryState;
  observed: ReadyObservation;
  root: string;
  recheckCommand: string;
}): RepositoryReadiness {
  const language = observed.outputLanguage;
  const { branch, changes, head } = repository;

  const dirty =
    changes.conflicted.length > 0
    || changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  const localProblems: { type: string; summary: string }[] = [];
  const localSteps: string[] = [];
  if (dirty) {
    if (changes.conflicted.length > 0) {
      localProblems.push({
        type: "worktree-conflicts",
        summary: renderWorktreeConflicts(language, {
          count: changes.conflicted.length,
          summary: summarizeWorktreeChanges({
            conflicted: changes.conflicted,
            staged: [],
            unstaged: [],
            untracked: [],
          }, language),
        }),
      });
    }
    if (
      changes.staged.length > 0
      || changes.unstaged.length > 0
      || changes.untracked.length > 0
    ) {
      localProblems.push({
        type: "worktree-changes",
        summary: summarizeWorktreeChanges({
          conflicted: [],
          staged: changes.staged,
          unstaged: changes.unstaged,
          untracked: changes.untracked,
        }, language),
      });
    }
    localSteps.push(...worktreeInstructionSteps(changes, language));
  }

  if (head === null) {
    const headMissing = renderHeadMissing(language);
    localProblems.push({
      type: "head-missing",
      summary: headMissing.summary,
    });
    localSteps.push(headMissing.nextSteps);
  }

  if (branch.branch === null) {
    const detachedHead = renderDetachedHead(language, {
      expectedBranch: observed.config.primaryBranch,
      expectedRepository: observed.config.primaryRepository,
      head,
    });
    localProblems.push({
      type: "detached-head",
      summary: detachedHead.summary,
    });
    localSteps.push(detachedHead.nextSteps);
  } else {
    if (
      branch.repository !== observed.config.primaryRepository
      || branch.upstreamBranch !== observed.config.primaryBranch
    ) {
      const mismatch = renderPrimaryUpstreamMismatch(language, {
        branch: branch.branch,
        expectedBranch: observed.config.primaryBranch,
        expectedRepository: observed.config.primaryRepository,
        remote: branch.remote,
        repository: branch.repository,
        upstreamBranch: branch.upstreamBranch,
        verifyCommand: command(
          root,
          'git -C "<root>" rev-parse --abbrev-ref --symbolic-full-name \'@{upstream}\'',
        ),
      });
      localProblems.push({
        type: "primary-upstream-mismatch",
        summary: mismatch.summary,
      });
      localSteps.push(mismatch.nextSteps);
    }
  }

  if (localProblems.length > 0) {
    return {
      branch,
      changes,
      head,
      observation: repositoryProblem(
        observed.observation,
        localProblems,
      ),
      instructions: localRepositoryInstructions(
        root,
        localSteps,
        language,
        recheckCommand,
      ),
      ready: false,
    };
  }

  if (head === null) {
    throw new Error("Ready repository unexpectedly omitted HEAD.");
  }
  return { branch, changes, head, observation: observed.observation, ready: true };
}
