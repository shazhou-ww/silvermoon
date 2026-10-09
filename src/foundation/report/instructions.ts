import { diagnosticInstruction, localize } from "./dialogue.ts";
import { resolveContentTemplateLanguage } from "../language/index.ts";
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
    localize(
      language,
      `After completing the applicable steps, run ${command(root, recheckCommand)} again.`,
      `完成适用步骤后，再运行 ${command(root, recheckCommand)}。`,
    ),
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
    localize(
      language,
      `After repairing the current phase guidance, run ${command(root, recheckCommand)} again.`,
      `修复当前阶段 guidance 后，再运行 ${command(root, recheckCommand)}。`,
    ),
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
  const labels: Record<string, string> = {
    conflicted: localize(language, "conflicted", "冲突"),
    staged: localize(language, "staged", "已暂存"),
    unstaged: localize(language, "unstaged", "未暂存"),
    untracked: localize(language, "untracked", "未跟踪"),
  };
  const counts = [
    ["conflicted", summary.counts.conflicted],
    ["staged", summary.counts.staged],
    ["unstaged", summary.counts.unstaged],
    ["untracked", summary.counts.untracked],
  ]
    .map(([kind, count]) => `${labels[String(kind)] ?? kind}=${count}`)
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

/** @pure */
export function worktreeInstructionSteps(changes: WorktreeChanges, language: string) {
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

/** @pure */
export function localRepositoryInstructions(
  root: string,
  steps: string[],
  language: string,
  recheckCommand: string,
) {
  return joinInstructions([
    ...formatInstructionSteps(steps),
    localize(
      language,
      `After completing every applicable step, run ${command(root, recheckCommand)} again.`,
      `完成全部适用步骤后，再运行 ${command(root, recheckCommand)}。`,
    ),
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
  return localize(
    language,
    `Use ${contentLanguage} for natural-language content in the current world, its supporting files, and the ledger. Preserve canonical headings, stable IDs, paths, and machine fields.`,
    `在当前世界、同世界辅助文件和 ledger 的自然语言内容中使用 ${contentLanguage}。保留 canonical 标题、稳定 ID、路径和机器字段。`,
  );
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
  const phaseText = {
    preparing: {
      gateLabel: localize(language, "Ideal World approval", "理想世界批准"),
      currentContract: localize(language, "Ideal World contract", "理想世界契约"),
      decisionQuestion: localize(
        language,
        `Do you approve \`${reference}\` as the Ideal World for this IDEA?`,
        `是否批准 \`${reference}\` 作为该 IDEA 的理想世界？`,
      ),
    },
    implementing: {
      gateLabel: localize(language, "Inner World acceptance", "主体世界验收"),
      currentContract: localize(language, "Inner World contract", "主体世界契约"),
      decisionQuestion: localize(
        language,
        `Do you accept \`${reference}\` as the Inner World implementation for this IDEA?`,
        `是否接受 \`${reference}\` 作为该 IDEA 的主体世界实现？`,
      ),
    },
    deploying: {
      gateLabel: localize(language, "Outer World acceptance", "现实世界验收"),
      currentContract: localize(language, "Outer World contract", "现实世界契约"),
      decisionQuestion: localize(
        language,
        `Do you accept \`${reference}\` as the Outer World outcome for this IDEA?`,
        `是否接受 \`${reference}\` 作为该 IDEA 的现实世界结果？`,
      ),
    },
  }[phase];
  return {
    contentLanguage,
    templateLanguage: template.tag,
    requiresLocalization: !template.localized,
    gateLabel: phaseText.gateLabel,
    candidateConnector: localize(language, "on primary", "位于 primary"),
    labels: {
      idea: localize(language, "Idea", "构想"),
      candidate: localize(language, "Candidate", "候选版本"),
      reviewFocus: localize(language, "Review focus", "审阅重点"),
      reviewFiles: localize(language, "Review files", "审阅文件"),
      decision: localize(language, "Decision", "决定"),
      local: localize(language, "local", "本地"),
      pinned: localize(language, "pinned", "固定版本"),
    },
    documentLabels: {
      "current-contract": phaseText.currentContract,
      ledger: localize(language, "Execution ledger", "执行清单"),
    },
    decisionQuestion: phaseText.decisionQuestion,
  };
}

/** @pure */
export function lifecycleReview(
  idea: LifecycleIdea,
  primaryCommit: string,
  contentLanguage: string,
): ReviewContext | undefined {
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
  return localize(
    language,
    "At the human gate, first render the reported review candidate as a standalone, completed assistant message with host-clickable local links and immutable primary links. Treat response.review.presentation as authoritative for every fixed gate label, document label, primary connector, and the exact decision question. When requiresLocalization is false, preserve those strings verbatim; when it is true, localize every human-visible presentation string into contentLanguage while preserving machine identifiers. Add only the idea identity, one-sentence focus, and selected review links in the reported compact order. Do not open an interactive decision in that same turn; its tool surface can hide the review index.",
    "到达人工门时，先把报告中的审阅候选作为一条独立且已完成的 assistant 消息呈现，并提供宿主可点击的本地链接与不可变 primary 链接。所有固定 gate 标签、文档标签、primary 连接语和准确决定问题都以 response.review.presentation 为准；requiresLocalization 为 false 时逐字保留这些字符串，为 true 时把所有面向人的呈现字符串本地化为 contentLanguage，同时保留机器标识。仅按报告的紧凑顺序补充 idea 身份、一句审阅重点和选定的审阅链接。不要在同一 turn 打开交互决定；工具界面可能隐藏审阅索引。",
  );
}

/** @pure */
function preparationSeedInstruction(idea: LifecycleIdea, language: string) {
  return localize(
    language,
    `Before requesting Ideal approval, replace scaffold placeholders with lightweight first versions in ${idea.worlds.implementationRevision.documentPath} and ${idea.worlds.deploymentRevision.documentPath}, then mirror their stable IDs and short titles in ${idea.ledgerPath}. Keep each downstream contract to no more than three high-level steps and three observable criteria. These provisional versions test feasibility but are outside the acceptIdeal decision.`,
    `请求 Ideal 批准前，把 ${idea.worlds.implementationRevision.documentPath} 和 ${idea.worlds.deploymentRevision.documentPath} 中的脚手架占位替换为轻量初版，并在 ${idea.ledgerPath} 中镜像其稳定 ID 与短标题。每份下游契约最多三个高层步骤和三个可观察标准。这些可调整的初版用于校验可行性，但不属于 acceptIdeal 决定范围。`,
  );
}

/** @pure */
export function lifecycleInstruction(
  idea: LifecycleIdea,
  language: string,
  contentLanguage: string,
) {
  const name = ideaName(idea);
  if (idea.statusPath.endsWith("/events.jsonl")) {
    const actions: Record<string, readonly [string, string, string]> = {
      preparing: ["acceptIdeal", idea.idealRevision, idea.worlds.idealRevision.documentPath],
      implementing: ["acceptInner", idea.implementationRevision, idea.worlds.implementationRevision.documentPath],
      deploying: ["acceptOuter", idea.deploymentRevision, idea.worlds.deploymentRevision.documentPath],
    };
    const action = actions[idea.state];
    return joinInstructions([
      action ? localize(language,
        `Continue ${name} in ${action[2]} and ${idea.ledgerPath}. Synchronize the candidate to primary before requesting the explicit human decision for ${action[0]} (revision reference ${revisionReference(action[1])}); retain the full revision from response.review for the exact decision record. Then use silvermoon event replay ${idea.id} --audience agent and silvermoon event append with its exact stream length, file digest and refreshed primary. Never edit events.jsonl directly.`,
        `在 ${action[2]} 和 ${idea.ledgerPath} 继续 ${name}。先同步候选到 primary，再请求 ${action[0]} 人工决定（revision reference ${revisionReference(action[1])}）；准确决定记录使用 response.review 中的完整 revision。之后用 silvermoon event replay ${idea.id} --audience agent 观察，并通过 silvermoon event append 绑定准确流长度、文件 digest 和刷新后的 primary 写入；不要直接编辑 events.jsonl。`)
        : localize(language,
          `Review ${name} (${idea.state}); preserve decisions. Resume only through idea.resumed after an explicit human decision; revise world content for changed requirements.`,
          `复查 ${name}（${idea.state}），保留已有决定。只有明确人工决定才通过 idea.resumed 恢复；需求变化应修改对应世界内容。`),
      idea.state === "preparing" ? preparationSeedInstruction(idea, language) : null,
      action ? reviewPresentationInstruction(language) : null,
      lifecycleContentLanguageInstruction(contentLanguage, language),
    ]);
  }
  if (idea.state === "preparing") {
    return joinInstructions([localize(
      language,
      `Continue idea ${name} in ${idea.worlds.idealRevision.documentPath} and ${idea.ledgerPath}. Preserve the other worlds. When the Ideal World is ready, ask the user to approve the candidate at revision reference ${revisionReference(idea.idealRevision)}; only after explicit approval write the full revision from response.review to approvedRevision in ${idea.statusPath}.`,
      `继续在 ${idea.worlds.idealRevision.documentPath} 和 ${idea.ledgerPath} 推进 idea ${name}，并保留其他世界。理想契约就绪后，请用户明确批准 revision reference ${revisionReference(idea.idealRevision)} 对应的候选；只有获得明确批准后，才将 response.review 中的完整 revision 写入 ${idea.statusPath} 的 approvedRevision。`,
    ), preparationSeedInstruction(idea, language), reviewPresentationInstruction(language), lifecycleContentLanguageInstruction(contentLanguage, language)]);
  }
  if (idea.state === "implementing") {
    return joinInstructions([localize(
      language,
      `Refine the preparation seed for idea ${name} in ${idea.worlds.implementationRevision.documentPath}, its supporting files under ${idea.worlds.implementationRevision.path}, and ${idea.ledgerPath} as concrete work requires. Do not change ${idea.worlds.idealRevision.path} unless the Ideal World must change. After all implementation evidence is published, ask the user to accept the candidate at revision reference ${revisionReference(idea.implementationRevision)}; only then write the full revision from response.review to implementationAcceptedRevision in ${idea.statusPath}.`,
      `按具体工作需要，在 ${idea.worlds.implementationRevision.documentPath}、${idea.worlds.implementationRevision.path} 下的辅助文件和 ${idea.ledgerPath} 中细化 idea ${name} 的准备阶段初版。除非理想契约确实需要变化，否则不要修改 ${idea.worlds.idealRevision.path}。全部实现证据发布后，请用户明确验收 revision reference ${revisionReference(idea.implementationRevision)} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${idea.statusPath} 的 implementationAcceptedRevision。`,
    ), reviewPresentationInstruction(language), lifecycleContentLanguageInstruction(contentLanguage, language)]);
  }
  if (idea.state === "deploying") {
    return joinInstructions([localize(
      language,
      `Refine the preparation seed for idea ${name} from ${idea.worlds.deploymentRevision.documentPath}, its supporting files under ${idea.worlds.deploymentRevision.path}, and ${idea.ledgerPath}. Preserve nested worlds. After external evidence is complete and published, ask the user to accept the candidate at revision reference ${revisionReference(idea.deploymentRevision)}; only then write the full revision from response.review to deploymentAcceptedRevision in ${idea.statusPath}.`,
      `从 ${idea.worlds.deploymentRevision.documentPath}、${idea.worlds.deploymentRevision.path} 下的辅助文件和 ${idea.ledgerPath} 细化 idea ${name} 的准备阶段初版，并保留内层世界。外部证据完成且发布后，请用户明确验收 revision reference ${revisionReference(idea.deploymentRevision)} 对应的候选；只有获得明确验收后，才将 response.review 中的完整 revision 写入 ${idea.statusPath} 的 deploymentAcceptedRevision。`,
    ), reviewPresentationInstruction(language), lifecycleContentLanguageInstruction(contentLanguage, language)]);
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

/** @pure */
export function navigationInstruction(ideas: Pick<IdeaReference, "state">[], language: string) {
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
