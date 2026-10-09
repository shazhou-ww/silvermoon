import {
  command,
  renderPrimaryAhead,
  renderPrimaryBehind,
  renderPrimaryDiverged,
  renderPrimaryHistoryIncomplete,
} from "../../foundation/report/index.ts";
import type {
  ReadyObservation,
  RepositoryBranch,
  RepositoryReadiness,
} from "./business-types.ts";
import { repositoryProblem } from "./business-types.ts";

/** @pure */
export function evaluatePrimaryRelation({
  relation,
  branch,
  head,
  primary,
  observed,
  root,
  recheckCommand,
}: {
  relation: "aligned" | "unknown" | "behind" | "ahead" | "diverged";
  branch: RepositoryBranch;
  head: string;
  primary: string;
  observed: ReadyObservation;
  root: string;
  recheckCommand: string;
}): RepositoryReadiness {
  if (relation === "aligned") {
    return { branch, head, observation: observed.observation, primary, ready: true };
  }
  const language = observed.outputLanguage;
  const parameters = {
    branch: branch.branch,
    head,
    mergeCommand: command(
      root,
      `git -C "<root>" merge --ff-only ${primary}`,
    ),
    primary,
    primaryBranch: observed.config.primaryBranch,
    recheckCommand: command(root, recheckCommand),
    remote: branch.remote,
  };
  const rendered = relation === "unknown"
    ? renderPrimaryHistoryIncomplete(language, parameters)
    : relation === "behind"
    ? renderPrimaryBehind(language, parameters)
    : relation === "ahead"
    ? renderPrimaryAhead(language, parameters)
    : renderPrimaryDiverged(language, parameters);
  const problem = {
    type: relation === "unknown"
      ? "primary-history-incomplete"
      : `primary-${relation}`,
    summary: rendered.summary,
  };
  return {
    branch,
    head,
    observation: repositoryProblem(observed.observation, [problem]),
    primary,
    instructions: rendered.instructions,
    ready: false,
  };
}
