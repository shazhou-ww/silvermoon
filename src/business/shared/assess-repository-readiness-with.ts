import { inspectEventHistory } from "../../foundation/event-history/index.ts";
import { compareCommits, fetchPrimary, inspectRepositoryState, sanitizeGitMessage } from "../../foundation/git/index.ts";
import { command } from "../../foundation/report/index.ts";
import { localize } from "../../foundation/language/index.ts";
import { evaluateLocalReadiness } from "./evaluate-local-readiness.ts";
import { evaluatePrimaryRelation } from "./evaluate-primary-relation.ts";
import type {
  CommandRuntime,
  ReadyObservation,
  RepositoryReadiness,
} from "./business-types.ts";
import { errorMessage, repositoryProblem } from "./business-types.ts";

const READINESS_PORTS = Object.freeze({
  inspectRepositoryState, fetchPrimary, compareCommits, inspectEventHistory,
});

type PrimaryRelation = "aligned" | "unknown" | "behind" | "ahead" | "diverged";

function isPrimaryRelation(value: string): value is PrimaryRelation {
  return value === "aligned" || value === "unknown" || value === "behind"
    || value === "ahead" || value === "diverged";
}

export async function assessRepositoryReadinessWith({
  observed,
  runtime,
  recheckCommand = "silvermoon whats-next",
  root,
  synchronizePrimary = true,
}: {
  observed: ReadyObservation;
  runtime: CommandRuntime;
  recheckCommand?: string;
  root: string;
  synchronizePrimary?: boolean;
}, ports: typeof READINESS_PORTS = READINESS_PORTS): Promise<RepositoryReadiness> {
  const { inspectRepositoryState, fetchPrimary, compareCommits, inspectEventHistory } = ports;
  const language = observed.outputLanguage;
  let repository;
  try {
    repository = inspectRepositoryState(root);
  } catch (caught) {
    const problem = {
      type: "worktree-inspection-failed",
      summary: sanitizeGitMessage(errorMessage(caught)),
    };
    return {
      observation: repositoryProblem(observed.observation, [problem]),
      instructions: localize(
        language,
        `Repair the local Git state, verify that all changes can be inspected, then run ${command(root, recheckCommand)} again.`,
        `修复本地 Git 状态，确认可检查全部修改后，再运行 ${command(root, recheckCommand)}。`,
      ),
      ready: false,
    };
  }
  const local = evaluateLocalReadiness({ repository, observed, root, recheckCommand });
  if (!local.ready) return local;
  const { branch, changes, head } = repository;
  if (head === null) throw new Error("Repository readiness unexpectedly omitted HEAD.");

  if (!synchronizePrimary) {
    return {
      branch,
      changes,
      head,
      observation: observed.observation,
      ready: true,
    };
  }

  const fetched = await runtime.performAction(
    {
      type: "fetch-primary",
      repository: observed.config.primaryRepository,
      branch: observed.config.primaryBranch,
    },
    () => ({
      commit: fetchPrimary(root, observed.config),
    }),
    (caught) => ({
      problem: {
        type: "primary-fetch-failed",
        summary: sanitizeGitMessage(errorMessage(caught)),
      },
    }),
  );
  if (fetched.status === "failure") {
    const message = fetched.problem.summary;
    return {
      observation: repositoryProblem(observed.observation, [{
        type: "primary-fetch-failed",
        summary: message,
      }]),
      instructions: localize(
        language,
        `Check network access, authorization, ${observed.config.primaryRepository}, and branch ${observed.config.primaryBranch}; after an observable fix, run ${command(root, recheckCommand)} again.`,
        `检查网络、授权、${observed.config.primaryRepository} 和分支 ${observed.config.primaryBranch}；产生可观察修复后，再运行 ${command(root, recheckCommand)}。`,
      ),
      ready: false,
    };
  }
  const primary = fetched.result.commit;
  let relation: PrimaryRelation;
  try {
    const compared = compareCommits(root, head, primary);
    if (!isPrimaryRelation(compared)) {
      throw new Error(`Git returned an unsupported primary relation: ${compared}`);
    }
    relation = compared;
  } catch (caught) {
    return {
      branch,
      head,
      observation: repositoryProblem(observed.observation, [{
        type: "primary-ancestry-inspection-failed",
        summary: sanitizeGitMessage(errorMessage(caught)),
      }]),
      primary,
      instructions: localize(
        language,
        `Repair or deepen local Git history until ${head} and ${primary} can be compared, then run ${command(root, recheckCommand)} again.`,
        `修复或补全本地 Git 历史，直到可以比较 ${head} 和 ${primary}，然后再运行 ${command(root, recheckCommand)}。`,
      ),
      ready: false,
    };
  }
  if (relation === "aligned") {
    if (observed.config.version === 2) {
      try {
        await inspectEventHistory({ root, tree: head, commit: head, config: observed.config, primary });
      } catch (caught) {
        return {
          branch, head, primary, ready: false,
          observation: repositoryProblem(observed.observation, [{
            type: "idea.events.history-invalid", summary: errorMessage(caught),
          }]),
          instructions: localize(language,
            `Preserve both histories. Review the selected commit's event boundary and repair only an authorized failure, then retry ${recheckCommand} --audience agent.`,
            `保留双方历史。检查所选提交的事件边界，仅在获得授权时修复明确的错误，然后重试 ${recheckCommand} --audience agent。`),
        };
      }
    }
    return { branch, head, observation: observed.observation, primary, ready: true };
  }
  return evaluatePrimaryRelation({
    relation, branch, head, primary, observed, root, recheckCommand,
  });
}
