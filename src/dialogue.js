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
  const target = intention.args.target;
  const detail = target.type === "commit" ? ` ${target.revision}` : "";
  return localize(
    language,
    `Validate the ${target.type}${detail} repository version.`,
    `验证 repository 的 ${target.type}${detail} 版本。`,
  );
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
    `${localize(language, "root", "根目录")}: ${observation.root}`,
  ];
  if (observation.observedThrough) {
    lines.push(
      `${localize(language, "observed through", "观测至")}: ${observation.observedThrough}`,
    );
  }
  const version = renderVersion(observation.version);
  if (version) {
    lines.push(`${localize(language, "version", "版本")}: ${version}`);
  }
  if (observation.configuration) {
    lines.push(
      `${localize(language, "primary", "主仓库")}: ${observation.configuration.primaryRepository}#${observation.configuration.primaryBranch}`,
    );
    lines.push(
      `${localize(language, "language", "语言")}: ${observation.configuration.preferredLanguage}`,
    );
  }
  if (observation.ideas) {
    const counts = observation.ideas.counts;
    lines.push(
      `${localize(language, "ideas", "ideas")}: preparing=${counts.preparing}, implementing=${counts.implementing}, `
      + `deploying=${counts.deploying}, completed=${counts.completed}, abandoned=${counts.abandoned}`,
    );
    for (const idea of observation.ideas.activeIdeas) {
      const alias = idea.alias === undefined ? "" : ` (${idea.alias})`;
      lines.push(
        `${localize(language, "active", "活跃")}: ${idea.id}${alias} ${idea.state}`,
      );
    }
  }
  for (const problem of observation.problems) {
    lines.push(
      `${localize(language, "problem", "问题")} [${problem.type}]: ${problem.summary}`,
    );
  }
  return lines.join("\n");
}

function renderOutcomes(outcomes, language) {
  if (outcomes.length === 0) {
    return localize(
      language,
      "No repository side effect was attempted.",
      "本次没有尝试 repository 副作用。",
    );
  }
  return outcomes
    .map((item) => {
      const status = item.status === "success"
        ? localize(language, "success", "成功")
        : localize(language, "failure", "失败");
      return `${status} [${item.type}]: ${item.summary}`;
    })
    .join("\n");
}

export function renderDialogue(report) {
  const language =
    report.observation.configuration?.preferredLanguage
    ?? "en-US";
  const sections = [
    [
      localize(language, "Intent", "意图"),
      renderIntention(report.intention, language),
    ],
    [
      localize(language, "Observation", "观察"),
      renderObservation(report.observation, language),
    ],
    [
      localize(language, "Actions and outcomes", "动作与结果"),
      renderOutcomes(report.outcomes, language),
    ],
    [
      localize(language, "Next", "下一步"),
      report.instructions,
    ],
  ];
  return sections.map(([heading, body]) => `${heading}\n${body}`).join("\n\n");
}

export { ACTIVE_STATES, IDEA_STATES };
