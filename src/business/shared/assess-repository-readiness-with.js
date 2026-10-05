import { inspectEventHistory } from "../../foundation/event-history/index.js";
import { compareCommits, fetchPrimary, inspectRepositoryState, sanitizeGitMessage } from "../../foundation/git/index.js";
import { command } from "../../foundation/report/index.js";
import { localize } from "../../foundation/language/index.js";
import { repositoryProblemObservation } from "../../foundation/report/index.js";
import { evaluateLocalReadiness } from "./evaluate-local-readiness.js";
import { evaluatePrimaryRelation } from "./evaluate-primary-relation.js";

const READINESS_PORTS = Object.freeze({
  inspectRepositoryState, fetchPrimary, compareCommits, inspectEventHistory,
});

export async function assessRepositoryReadinessWith({
  observed,
  runtime,
  recheckCommand = "silvermoon whats-next",
  root,
  synchronizePrimary = true,
}, ports = READINESS_PORTS) {
  const { inspectRepositoryState, fetchPrimary, compareCommits, inspectEventHistory } = ports;
  const language = observed.outputLanguage;
  let repository;
  try {
    repository = inspectRepositoryState(root);
  } catch (caught) {
    const problem = {
      type: "worktree-inspection-failed",
      summary: sanitizeGitMessage(caught.message),
    };
    return {
      observation: repositoryProblemObservation(observed.observation, [problem]),
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
        summary: sanitizeGitMessage(caught.message),
      },
    }),
  );
  if (fetched.status === "failure") {
    const message = fetched.problem.summary;
    return {
      observation: repositoryProblemObservation(observed.observation, [{
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
  let relation;
  try {
    relation = compareCommits(root, head, primary);
  } catch (caught) {
    return {
      branch,
      head,
      observation: repositoryProblemObservation(observed.observation, [{
        type: "primary-ancestry-inspection-failed",
        summary: sanitizeGitMessage(caught.message),
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
          observation: repositoryProblemObservation(observed.observation, [{
            type: "idea.events.history-invalid", summary: caught.message,
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
