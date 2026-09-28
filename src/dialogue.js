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

export function dialogueReadyObservation(observation, state, details = {}) {
  const { root, version, configuration, problems } = observation;
  return { state, root, version, configuration, problems, ...details };
}

function renderIntention(intention, language) {
  if (intention.command === "whats-next") {
    return intention.args.idea === null
      ? localize(
        language,
        "Determine the available next work.",
        "查看当前可推进的工作。",
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
        `Create one new idea and use ${language} for natural-language content.`,
        `创建一个新 idea，并使用 ${language} 撰写自然语言内容。`,
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
  if (observation.state === "idea-selected") {
    const idea = observation.selectedIdea;
    const alias = idea.alias === undefined ? "" : ` (${idea.alias})`;
    return localize(
      language,
      `The project and repository are ready. Selected idea: ${codeSpan(idea.id)}${alias}; state: ${idea.state}.`,
      `项目与 repository 已就绪。当前 idea：${codeSpan(idea.id)}${alias}；状态：${idea.state}。`,
    );
  }
  if (observation.state === "idea-created") {
    return localize(
      language,
      `The local repository was ready before creation. Created idea: ${codeSpan(observation.createdIdea.id)}; path: ${codeSpan(observation.createdIdea.path)}; state: preparing.`,
      `创建前项目与本地 repository 已就绪。新建 idea：${codeSpan(observation.createdIdea.id)}；路径：${codeSpan(observation.createdIdea.path)}；状态：preparing。`,
    );
  }
  if (observation.state === "idea-create-failed") {
    return localize(
      language,
      "The repository was ready before creation, but creating the idea failed.",
      "创建前项目与 repository 已就绪，但创建 idea 失败。",
    );
  }
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
    "repository-preparation-required": localize(
      language,
      "The project is ready, but the local repository must be prepared before creating an idea.",
      "项目已就绪，但创建 idea 前仍需整备本地 repository。",
    ),
    "navigation-ready": localize(
      language,
      observation.ideas?.activeIdeas.length > 0
        ? "The project and repository are ready, and work is available."
        : "The project and repository are ready, with no active idea.",
      observation.ideas?.activeIdeas.length > 0
        ? "项目与 repository 已就绪，当前有工作可以推进。"
        : "项目与 repository 已就绪，当前没有 active idea。",
    ),
    "idea-not-found": localize(
      language,
      "The project and repository are ready, but the requested idea was not found.",
      "项目与 repository 已就绪，但未找到指定的 idea。",
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
      `- ${localize(language, "interaction language", "交互语言")}: ${observation.configuration.preferredLanguage}`,
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
  const candidates = observation.state === "idea-not-found"
    ? observation.candidates
    : observation.ideas?.activeIdeas;
  if (candidates?.length > 0) {
    const active = candidates.map((idea) => {
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
  const visibleOutcomes = report.outcomes.filter((item) =>
    !(item.type === "fetch-primary"
      && item.status === "success"
      && ["navigation-ready", "idea-selected", "idea-not-found", "idea-created", "idea-create-failed"]
        .includes(report.observation.state))
  );
  const sections = [
    [
      localize(language, "Current instruction", "本次指示"),
      renderIntention(report.intention, language),
    ],
    [
      localize(language, "Project status", "项目现状"),
      renderObservation(report.observation, language),
    ],
    ...(visibleOutcomes.length > 0
      ? [[
        localize(language, "Actions and results", "本次操作及结果"),
        renderOutcomes(visibleOutcomes, language),
      ]]
      : []),
    [
      localize(language, "Suggested next steps", "下一步建议"),
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
