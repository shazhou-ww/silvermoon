import { resolve } from "node:path";

import {
  ACTIVE_STATES,
  diagnosticInstruction,
  diagnosticProblem,
  dialogueReadyObservation,
  localize,
} from "./dialogue.js";
import { createCommandRun } from "./domain.js";
import { inspectPhaseGuidance } from "./guidance.js";
import {
  compareCommits,
  fetchPrimary,
  inspectCurrentBranch,
  inspectWorktreeChanges,
  resolveHead,
  sanitizeGitMessage,
} from "./git.js";
import { canonicalizeOutputLanguage } from "./language.js";
import {
  observeSnapshot,
  repositoryProblemObservation,
  withObservationLanguage,
} from "./observation.js";
import { traceAsync } from "./trace.js";

export const CHANGE_SAMPLE_ITEM_LIMIT = 12;
export const CHANGE_SAMPLE_BYTE_LIMIT = 768;

function ideaName(idea) {
  return idea.alias ?? idea.id;
}

function command(root, value) {
  return `\`${value.replace("<root>", root)}\``;
}

function joinInstructions(lines) {
  return lines.filter(Boolean).join("\n");
}

function formatInstructionSteps(steps) {
  return steps.length === 1
    ? steps
    : steps.map((step, index) => `${index + 1}. ${step}`);
}

export function projectInstructions(
  observed,
  root,
  language,
  recheckCommand = "silvermoon whats-next",
) {
  return joinInstructions([
    ...formatInstructionSteps(observed.findings.map(({ instruction }) => instruction)),
    localize(
      language,
      `After completing the applicable steps, run ${command(root, recheckCommand)} again.`,
      `完成适用步骤后，再运行 ${command(root, recheckCommand)}。`,
    ),
  ]);
}

export function phaseGuidanceInstructions(
  diagnostics,
  root,
  language,
  recheckCommand,
) {
  return joinInstructions([
    ...formatInstructionSteps(
      diagnostics.map((diagnostic) =>
        diagnosticInstruction(diagnostic, language)
      ),
    ),
    localize(
      language,
      `After repairing the current phase guidance, run ${command(root, recheckCommand)} again.`,
      `修复当前阶段 guidance 后，再运行 ${command(root, recheckCommand)}。`,
    ),
  ]);
}

function sampleChanges(changes) {
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

export function summarizeWorktreeChanges(changes, language = "en-US") {
  const summary = sampleChanges(changes);
  const labels = {
    conflicted: localize(language, "conflicted", "冲突"),
    staged: localize(language, "staged", "已暂存"),
    unstaged: localize(language, "unstaged", "未暂存"),
    untracked: localize(language, "untracked", "未跟踪"),
  };
  const counts = Object.entries(summary.counts)
    .map(([kind, count]) => `${labels[kind]}=${count}`)
    .join(localize(language, ", ", "，"));
  const samples = summary.samples.length === 0
    ? localize(language, "none", "无")
    : summary.samples.join(localize(language, ", ", "，"));
  return localize(
    language,
    `${counts}; samples=[${samples}]; omitted=${summary.omitted}`,
    `${counts}；样例=[${samples}]；省略=${summary.omitted}`,
  );
}

function worktreeInstructionSteps(changes, language) {
  const lines = [];
  if (changes.conflicted.length > 0) {
    lines.push(localize(
      language,
      "Inspect every conflicted path and its contents, then resolve the conflicts without discarding either side.",
      "检查全部冲突路径及其内容，再在不丢弃任一方内容的前提下解决冲突。",
    ));
  }
  const hasOrdinaryChanges =
    changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  if (hasOrdinaryChanges) {
    lines.push(localize(
      language,
      "Inspect all staged, unstaged, and untracked paths and their changes, not just the samples above. Preserve unknown work, then commit, isolate, or explicitly discard each change.",
      "检查全部 staged、unstaged 和 untracked 路径及其修改内容，不要只依据上述样例。保留未知工作，再逐项提交、隔离，或在获得明确授权后放弃。",
    ));
  }
  return lines;
}

function localRepositoryInstructions(root, steps, language, recheckCommand) {
  return joinInstructions([
    ...formatInstructionSteps(steps),
    localize(
      language,
      `After completing every applicable step, run ${command(root, recheckCommand)} again.`,
      `完成全部适用步骤后，再运行 ${command(root, recheckCommand)}。`,
    ),
  ]);
}

function selectIdea(ideas, selector) {
  if (selector === undefined) return null;
  return ideas.find(({ id }) => id === selector)
    ?? ideas.find(({ alias }) => alias === selector)
    ?? null;
}

function lifecycleInstruction(idea, language) {
  const name = ideaName(idea);
  if (idea.state === "preparing") {
    return localize(
      language,
      `Continue idea ${name} in ${idea.worlds.idealRevision.documentPath} and ${idea.ledgerPath}. Preserve the other worlds. When the Ideal World is ready, ask the user to approve exact revision ${idea.idealRevision}; only after explicit approval write it to approvedRevision in ${idea.statusPath}.`,
      `继续在 ${idea.worlds.idealRevision.documentPath} 和 ${idea.ledgerPath} 推进 idea ${name}，并保留其他世界。理想契约就绪后，请用户明确批准精确 revision ${idea.idealRevision}；只有获得明确批准后，才将其写入 ${idea.statusPath} 的 approvedRevision。`,
    );
  }
  if (idea.state === "implementing") {
    return localize(
      language,
      `Continue idea ${name} in ${idea.worlds.implementationRevision.documentPath}, its supporting files under ${idea.worlds.implementationRevision.path}, and ${idea.ledgerPath}. Do not change ${idea.worlds.idealRevision.path} unless the Ideal World must change. After all implementation evidence is published, ask the user to accept exact revision ${idea.implementationRevision}; only then write it to implementationAcceptedRevision in ${idea.statusPath}.`,
      `继续在 ${idea.worlds.implementationRevision.documentPath}、${idea.worlds.implementationRevision.path} 下的辅助文件和 ${idea.ledgerPath} 推进 idea ${name}。除非理想契约确实需要变化，否则不要修改 ${idea.worlds.idealRevision.path}。全部实现证据发布后，请用户明确验收精确 revision ${idea.implementationRevision}；只有获得明确验收后，才将其写入 ${idea.statusPath} 的 implementationAcceptedRevision。`,
    );
  }
  if (idea.state === "deploying") {
    return localize(
      language,
      `Continue idea ${name} from ${idea.worlds.deploymentRevision.documentPath}, its supporting files under ${idea.worlds.deploymentRevision.path}, and ${idea.ledgerPath}. Preserve nested worlds. After external evidence is complete and published, ask the user to accept exact revision ${idea.deploymentRevision}; only then write it to deploymentAcceptedRevision in ${idea.statusPath}.`,
      `从 ${idea.worlds.deploymentRevision.documentPath}、${idea.worlds.deploymentRevision.path} 下的辅助文件和 ${idea.ledgerPath} 继续推进 idea ${name}，并保留内层世界。外部证据完成且发布后，请用户明确验收精确 revision ${idea.deploymentRevision}；只有获得明确验收后，才将其写入 ${idea.statusPath} 的 deploymentAcceptedRevision。`,
    );
  }
  if (idea.state === "abandoned") {
    return localize(
      language,
      `Review abandoned idea ${name} at ${idea.relativePath}. Keep abandoned: true in ${idea.statusPath}, remove it only after an explicit decision to resume, or discuss a different goal and run silvermoon create-idea.`,
      `复查位于 ${idea.relativePath} 的已放弃 idea ${name}。保持 ${idea.statusPath} 中的 abandoned: true；只有明确决定恢复时才移除它，或者讨论另一个目标并运行 silvermoon create-idea。`,
    );
  }
  return localize(
    language,
    `Review completed idea ${name} at ${idea.relativePath}. If its definition must change, revise the existing idea; otherwise discuss a new goal and run silvermoon create-idea.`,
    `复查位于 ${idea.relativePath} 的已完成 idea ${name}。若其定义需要变化则修订现有 idea；否则讨论新目标并运行 silvermoon create-idea。`,
  );
}

function navigationInstruction(ideas, language) {
  const hasActiveIdea = ideas.some(({ state }) =>
    state === "preparing" || state === "implementing" || state === "deploying"
  );
  return joinInstructions([
    localize(
      language,
      "Choose explicitly whether to continue an active idea or create a new one.",
      "请明确选择继续一个 active idea，或创建一个新 idea。",
    ),
    hasActiveIdea
      ? null
      : localize(language, "No active ideas are available.", "当前没有 active idea。"),
    localize(
      language,
      "To continue, run `silvermoon whats-next <ULID-or-alias>`. To start something else, discuss the goal and run `silvermoon create-idea`.",
      "如需继续，运行 `silvermoon whats-next <ULID-or-alias>`；如需开始其他工作，先讨论目标，再运行 `silvermoon create-idea`。",
    ),
  ]);
}

async function assessRepositoryReadinessInternal({
  observed,
  runtime,
  requirePrimaryBranch = false,
  recheckCommand = "silvermoon whats-next",
  root,
  synchronizePrimary = true,
}) {
  const language = observed.outputLanguage;
  let changes;
  try {
    changes = inspectWorktreeChanges(root);
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

  const dirty =
    changes.conflicted.length > 0
    || changes.staged.length > 0
    || changes.unstaged.length > 0
    || changes.untracked.length > 0;
  const localProblems = [];
  const localSteps = [];
  if (dirty) {
    if (changes.conflicted.length > 0) {
      localProblems.push({
        type: "worktree-conflicts",
        summary: localize(
          language,
          `${changes.conflicted.length} conflicted path(s); ${summarizeWorktreeChanges({
            conflicted: changes.conflicted,
            staged: [],
            unstaged: [],
            untracked: [],
          }, language)}`,
          `${changes.conflicted.length} 个冲突路径；${summarizeWorktreeChanges({
            conflicted: changes.conflicted,
            staged: [],
            unstaged: [],
            untracked: [],
          }, language)}`,
        ),
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

  const head = resolveHead(root);
  if (head === null) {
    localProblems.push({
      type: "head-missing",
      summary: localize(
        language,
        "The repository has no commit at HEAD.",
        "repository 的 HEAD 尚无 commit。",
      ),
    });
    localSteps.push(localize(
      language,
      "After resolving conflicts and deciding which local changes belong, create the initial commit on the intended branch.",
      "解决冲突并确认应保留的本地修改后，在预期分支创建初始 commit。",
    ));
  }

  const branch = inspectCurrentBranch(root);
  if (branch.branch === null) {
    localProblems.push({
      type: "detached-head",
      summary: localize(
        language,
        head === null
          ? "The repository has no current local branch."
          : `HEAD ${head} is detached and has no current branch.`,
        head === null
          ? "repository 当前没有本地分支。"
          : `HEAD ${head} 处于 detached 状态，没有当前分支。`,
      ),
    });
    localSteps.push(localize(
      language,
      `Preserve current work, then switch to or create the intended local branch whose upstream is ${observed.config.primaryRepository}#${observed.config.primaryBranch}.`,
      `保留当前工作，然后切换或创建 upstream 为 ${observed.config.primaryRepository}#${observed.config.primaryBranch} 的预期本地分支。`,
    ));
  } else {
    if (requirePrimaryBranch && branch.branch !== observed.config.primaryBranch) {
      localProblems.push({
        type: "primary-branch-mismatch",
        summary: localize(
          language,
          `Current branch is ${branch.branch}; expected configured primary branch ${observed.config.primaryBranch}.`,
          `当前分支为 ${branch.branch}；预期为 configured primary branch ${observed.config.primaryBranch}。`,
        ),
      });
      localSteps.push(localize(
        language,
        `Preserve current work, then switch to configured primary branch ${observed.config.primaryBranch}.`,
        `保留当前工作，然后切换到 configured primary branch ${observed.config.primaryBranch}。`,
      ));
    }
    if (
      branch.repository !== observed.config.primaryRepository
      || branch.upstreamBranch !== observed.config.primaryBranch
    ) {
      const actual = branch.remote === null
        ? localize(language, "none", "无")
        : `${branch.repository ?? branch.remote}#${branch.upstreamBranch ?? localize(language, "unknown", "未知")}`;
      localProblems.push({
        type: "primary-upstream-mismatch",
        summary: localize(
          language,
          `Branch ${branch.branch} has upstream ${actual}; expected ${observed.config.primaryRepository}#${observed.config.primaryBranch}.`,
          `分支 ${branch.branch} 的 upstream 是 ${actual}；预期为 ${observed.config.primaryRepository}#${observed.config.primaryBranch}。`,
        ),
      });
      localSteps.push(localize(
        language,
        `Configure a named remote for ${observed.config.primaryRepository}, then set branch ${branch.branch} to track that remote's ${observed.config.primaryBranch} branch. Verify with ${command(root, 'git -C "<root>" rev-parse --abbrev-ref --symbolic-full-name \'@{upstream}\'')}.`,
        `为 ${observed.config.primaryRepository} 配置 named remote，再将分支 ${branch.branch} 的 upstream 设为该 remote 的 ${observed.config.primaryBranch}。使用 ${command(root, 'git -C "<root>" rev-parse --abbrev-ref --symbolic-full-name \'@{upstream}\'')} 验证。`,
      ));
    }
  }

  if (localProblems.length > 0) {
    return {
      branch,
      changes,
      head,
      observation: repositoryProblemObservation(
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
    return { branch, head, observation: observed.observation, primary, ready: true };
  }
  const problem = {
    type: relation === "unknown"
      ? "primary-history-incomplete"
      : `primary-${relation}`,
    summary: localize(
      language,
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is ${relation}.`,
      `本地 HEAD 为 ${head}；观测到的 primary 为 ${primary}；两者关系为 ${relation}。`,
    ),
  };
  let instructions;
  if (relation === "unknown") {
    instructions = localize(
      language,
      `Deepen the shallow history from remote ${branch.remote} until ${head} and ${primary} can be compared, then run ${command(root, recheckCommand)} again.`,
      `从 remote ${branch.remote} 补全 shallow history，直到可以比较 ${head} 和 ${primary}，然后再运行 ${command(root, recheckCommand)}。`,
    );
  } else if (relation === "behind") {
    instructions = localize(
      language,
      `Fast-forward branch ${branch.branch} to observed primary ${primary} with ${command(root, `git -C "<root>" merge --ff-only ${primary}`)} without rewriting history, then run ${command(root, recheckCommand)} again.`,
      `使用 ${command(root, `git -C "<root>" merge --ff-only ${primary}`)} 将分支 ${branch.branch} fast-forward 到已观察 primary ${primary}，不要改写历史，然后再运行 ${command(root, recheckCommand)}。`,
    );
  } else if (relation === "ahead") {
    instructions = localize(
      language,
      `Validate local commit ${head}, confirm the remote tip is still ${primary}, then push normally to ${branch.remote}/${observed.config.primaryBranch} without force. Re-run ${command(root, recheckCommand)} after the push.`,
      `验证本地 commit ${head}，确认 remote tip 仍为 ${primary}，再普通 push 到 ${branch.remote}/${observed.config.primaryBranch}，不要 force。push 后重新运行 ${command(root, recheckCommand)}。`,
    );
  } else {
    instructions = localize(
      language,
      `Preserve local ${head} and remote ${primary}, integrate both histories without force-pushing, resolve and validate the result, then run ${command(root, recheckCommand)} again.`,
      `保留本地 ${head} 与 remote ${primary}，在不 force-push 的前提下整合两边历史，解决并验证结果，然后再运行 ${command(root, recheckCommand)}。`,
    );
  }
  return {
    branch,
    head,
    observation: repositoryProblemObservation(observed.observation, [problem]),
    primary,
    instructions,
    ready: false,
  };
}

export async function assessRepositoryReadiness(options) {
  return traceAsync(
    "repository.assess-readiness",
    {},
    () => assessRepositoryReadinessInternal(options),
  );
}

export async function assessIdeaCreationReadiness(options) {
  return traceAsync(
    "repository.assess-creation-readiness",
    {},
    () => assessRepositoryReadinessInternal({
      ...options,
      requirePrimaryBranch: true,
      synchronizePrimary: false,
    }),
  );
}

export async function whatsNext({
  guidanceReader = inspectPhaseGuidance,
  idea: selector,
  language,
  root = process.cwd(),
  userHome,
} = {}) {
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
  const baseRecheckCommand = selector === undefined
    ? "silvermoon whats-next"
    : `silvermoon whats-next ${JSON.stringify(selector)}`;
  const recheckCommand = canonicalLanguage === undefined
    ? baseRecheckCommand
    : `${baseRecheckCommand} --language ${canonicalLanguage}`;
  let observed = await observeSnapshot({
    outputLanguage: canonicalLanguage,
    root: requestedRoot,
    userHome,
    version: { type: "worktree" },
  });
  runtime.observe(observed.observation, { factType: "project.snapshot" });
  if (!observed.projectReady) {
    return runtime.complete(
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
  }

  const selected = selectIdea(observed.layout.ideas, selector);
  if (selected?.status.language) {
    observed = withObservationLanguage(observed, selected.status.language);
  }
  const readiness = await assessRepositoryReadiness({
    observed,
    runtime,
    recheckCommand,
    root: observed.observation.root,
  });
  if (!readiness.ready) {
    return runtime.complete(
      readiness.observation,
      { nextSteps: readiness.instructions },
    );
  }

  if (selector === undefined) {
    return runtime.complete(
      { ...readiness.observation, state: "navigation-ready" },
      {
        nextSteps: navigationInstruction(
          observed.layout.ideas,
          observed.outputLanguage,
        ),
      },
    );
  }
  if (!selected) {
    return runtime.complete(
      dialogueReadyObservation(readiness.observation, "idea-not-found", {
        candidates: readiness.observation.ideas.activeIdeas,
      }),
      {
        nextSteps: joinInstructions([
          localize(
            observed.outputLanguage,
            `Idea ${selector} does not match an observed ULID or unique alias.`,
            `Idea ${selector} 未匹配任何已观察到的 ULID 或唯一 alias。`,
          ),
          navigationInstruction(observed.layout.ideas, observed.outputLanguage),
        ]),
      },
    );
  }

  const selectedIdea = {
    id: selected.id,
    ...(selected.alias === undefined ? {} : { alias: selected.alias }),
    state: selected.state,
  };
  let guidance;
  if (ACTIVE_STATES.has(selected.state)) {
    const inspected = await guidanceReader({
      gitRoot: readiness.observation.root,
      phase: selected.state,
      snapshotTree: readiness.primary,
    });
    if (inspected.state === "invalid") {
      return runtime.complete(
        dialogueReadyObservation(
          readiness.observation,
          "phase-guidance-invalid",
          {
            selectedIdea,
            problems: inspected.diagnostics.map((diagnostic) =>
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
    }
    guidance = inspected.guidance;
  }
  return runtime.complete(
    dialogueReadyObservation(readiness.observation, "idea-selected", {
      selectedIdea,
      ...(guidance === undefined ? {} : { guidance }),
    }),
    {
      nextSteps: lifecycleInstruction(selected, observed.outputLanguage),
    },
  );
}
