const ACTIVE_STATES = new Set(["preparing", "implementing", "deploying"]);
const IDEA_STATES = [
  "preparing",
  "implementing",
  "deploying",
  "completed",
  "abandoned",
];

function isChinese(language) {
  return language?.toLowerCase().startsWith("zh");
}

export function localize(language, english, chinese) {
  return isChinese(language) ? chinese : english;
}

export function diagnosticProblem(diagnostic, language = "en-US") {
  const location = diagnostic.path ? ` (${diagnostic.path})` : "";
  return {
    type: diagnostic.code.replaceAll(".", "-"),
    summary: localize(
      language,
      `${diagnostic.message}${location}`.trim(),
      diagnostic.path
        ? `在 ${diagnostic.path} 发现 ${diagnostic.code}：${diagnostic.message}`
        : `发现 ${diagnostic.code}：${diagnostic.message}`,
    ),
  };
}

export function diagnosticInstruction(diagnostic, language = "en-US") {
  return localize(
    language,
    diagnostic.remediation,
    diagnostic.path
      ? `修复 ${diagnostic.path} 的 ${diagnostic.code}：${diagnostic.remediation}`
      : `修复 ${diagnostic.code}：${diagnostic.remediation}`,
  );
}

export function outcome(type, status, summary) {
  return { type, status, summary };
}

export function summarizeIdeas(ideas) {
  const counts = Object.fromEntries(IDEA_STATES.map((state) => [state, 0]));
  const activeIdeas = [];
  for (const idea of ideas) {
    counts[idea.state] += 1;
    if (ACTIVE_STATES.has(idea.state)) {
      const reference = { id: idea.id, state: idea.state };
      if (idea.alias !== undefined) reference.alias = idea.alias;
      activeIdeas.push(reference);
    }
  }
  activeIdeas.sort((left, right) => left.id.localeCompare(right.id));
  return { counts, activeIdeas };
}

export function resolvedConfiguration(config, preferredLanguage) {
  return {
    primaryRepository: config.primaryRepository,
    primaryBranch: config.primaryBranch,
    preferredLanguage,
  };
}

export function createEnvelope(intention, observation, outcomes, instructions) {
  return { intention, observation, outcomes, instructions };
}

function renderIntention(intention, language) {
  if (intention.command === "whats-next") {
    return intention.args.idea === null
      ? localize(
        language,
        "Determine the available next work without selecting an idea.",
        "查看当前可推进的工作，但不替用户选择 idea。",
      )
      : localize(
        language,
        `Determine what is next for idea ${intention.args.idea}.`,
        `查看 idea ${intention.args.idea} 接下来应做什么。`,
      );
  }
  if (intention.command === "create-idea") {
    return intention.args.language === null
      ? localize(
        language,
        "Create one new idea using the effective project language.",
        "使用项目的有效语言创建一个新 idea。",
      )
      : localize(
        language,
        `Create one new idea with language ${intention.args.language}.`,
        `使用 ${intention.args.language} 创建一个新 idea。`,
      );
  }
  throw new Error(`Cannot render dialogue for ${intention.command}`);
}

function renderVersion(version) {
  if (!version) return null;
  if (version.type === "commit" || version.type === "remote") {
    return version.commit === null
      ? version.type
      : `${version.type} ${version.commit}`;
  }
  return version.type;
}

function codeSpan(value) {
  const text = String(value);
  let longest = 0;
  for (const [run] of text.matchAll(/`+/g)) {
    longest = Math.max(longest, run.length);
  }
  const fence = "`".repeat(longest + 1);
  return longest === 0 ? `${fence}${text}${fence}` : `${fence} ${text} ${fence}`;
}

function renderObservation(observation, language) {
  const state = {
    "project-setup-required": localize(
      language,
      "The project requires Silvermoon setup.",
      "项目需要完成 Silvermoon 整备。",
    ),
    "repository-sync-required": localize(
      language,
      "The project is configured, but the repository requires synchronization.",
      "项目配置已就绪，但 repository 仍需整备或同步。",
    ),
    "task-pending": localize(
      language,
      "The project and repository are ready, and work is available.",
      "项目与 repository 已就绪，当前有工作可以推进。",
    ),
    idle: localize(
      language,
      "The project and repository are ready, with no active idea.",
      "项目与 repository 已就绪，当前没有 active idea。",
    ),
  }[observation.state];
  const lines = [
    state,
    `- ${localize(language, "root", "根目录")}: ${codeSpan(observation.root)}`,
  ];
  if (observation.observedThrough) {
    lines.push(
      `- ${localize(language, "observed through", "观测至")}: ${observation.observedThrough}`,
    );
  }
  const version = renderVersion(observation.version);
  if (version) {
    lines.push(`- ${localize(language, "version", "版本")}: ${codeSpan(version)}`);
  }
  if (observation.configuration) {
    lines.push(
      `- ${localize(language, "primary", "主仓库")}: ${codeSpan(`${observation.configuration.primaryRepository}#${observation.configuration.primaryBranch}`)}`,
    );
    lines.push(
      `- ${localize(language, "language", "语言")}: ${observation.configuration.preferredLanguage}`,
    );
  }
  if (observation.ideas) {
    const counts = observation.ideas.counts;
    lines.push(
      `- ${localize(language, "ideas", "ideas")}: preparing=${counts.preparing}, implementing=${counts.implementing}, `
      + `deploying=${counts.deploying}, completed=${counts.completed}, abandoned=${counts.abandoned}`,
    );
  }
  const sections = [`${lines[0]}\n\n${lines.slice(1).join("\n")}`];
  if (observation.ideas?.activeIdeas.length > 0) {
    const active = observation.ideas.activeIdeas.map((idea) => {
      const alias = idea.alias === undefined ? "" : ` (${idea.alias})`;
      return `- ${codeSpan(idea.id)}${alias} ${idea.state}`;
    });
    sections.push(`### ${localize(language, "Ideas you can continue", "可继续推进的想法")}\n\n${active.join("\n")}`);
  }
  if (observation.problems.length > 0) {
    const problems = observation.problems.map((problem) =>
      `- [${problem.type}] ${problem.summary}`
    );
    sections.push(`### ${localize(language, "Issues to address", "需要处理的问题")}\n\n${problems.join("\n")}`);
  }
  return sections.join("\n\n");
}

function renderOutcomes(outcomes, language) {
  return outcomes
    .map((item) => {
      const status = item.status === "success"
        ? localize(language, "success", "成功")
        : localize(language, "failure", "失败");
      return `- ${status} [${item.type}]: ${item.summary}`;
    })
    .join("\n");
}

export function renderDialogue(report) {
  const language =
    report.observation.configuration?.preferredLanguage
    ?? "en-US";
  const sections = [
    [
      localize(language, "Request", "本次请求"),
      renderIntention(report.intention, language),
    ],
    [
      localize(language, "Current state", "当前情况"),
      renderObservation(report.observation, language),
    ],
    ...(report.outcomes.length > 0
      ? [[
        localize(language, "Actions and results", "本次操作及结果"),
        renderOutcomes(report.outcomes, language),
      ]]
      : []),
    [
      localize(language, "What to do next", "接下来怎么做"),
      report.instructions,
    ],
  ];
  return sections.map(([heading, body]) => `## ${heading}\n\n${body}`).join("\n\n");
}

export function renderCheck(report) {
  const language = report.observation.configuration?.preferredLanguage ?? "en-US";
  const { target } = report.intention.args;
  const version = renderVersion(report.observation.version);
  const label = target.type === "commit"
    ? `${target.type} ${target.revision}`
    : target.type;
  const valid = report.observation.state === "project-ready";
  const lines = [
    `## ${localize(language, "Check", "检查")}`,
    "",
    `- ${localize(language, "Target", "目标")}: ${codeSpan(label)}`,
  ];
  if (version) lines.push(`- ${localize(language, "Version", "版本")}: ${codeSpan(version)}`);
  lines.push(
    `- ${localize(language, "Result", "结果")}: ${valid
      ? localize(language, "valid", "通过")
      : localize(language, "invalid or unavailable", "未通过或无法验证")}`,
  );
  if (report.observation.problems.length > 0) {
    lines.push("", `### ${localize(language, "Issues to address", "需要处理的问题")}`, "");
    for (const problem of report.observation.problems) {
      lines.push(`- [${problem.type}] ${problem.summary}`);
    }
  }
  return lines.join("\n");
}

export { ACTIVE_STATES, IDEA_STATES };
