import {
  DEFAULT_LANGUAGE,
  localize,
  resolveOutputLanguage,
} from "./language.js";

const BLOCKED_STATES = new Set([
  "check-unavailable",
  "idea-create-failed",
  "phase-guidance-invalid",
  "project-setup-required",
  "repository-preparation-required",
  "repository-sync-required",
]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function responseLanguage(intention, observation) {
  return observation.outputLanguage
    ?? resolveOutputLanguage({
      content: observation.configuration?.preferredLanguage,
      override: intention.args?.language ?? undefined,
    }).tag
    ?? DEFAULT_LANGUAGE;
}

function normalizeNextSteps(nextSteps) {
  if (nextSteps === undefined || nextSteps === null || nextSteps === "") {
    return [];
  }
  const values = Array.isArray(nextSteps) ? nextSteps : [nextSteps];
  return values.map((step) =>
    typeof step === "string"
      ? { type: "instruction", text: step }
      : clone(step)
  );
}

function observationDetails(observation) {
  const details = {};
  if (observation.root !== undefined) details.root = observation.root;
  if (observation.version !== undefined) details.version = clone(observation.version);
  if (observation.configuration !== undefined) {
    details.primary = {
      repository: observation.configuration.primaryRepository,
      branch: observation.configuration.primaryBranch,
    };
    details.contentLanguage = observation.configuration.preferredLanguage;
  }
  return details;
}

function blockedSummary(command, observation, language) {
  const summaries = {
    "check-unavailable": localize(
      language,
      "The requested repository snapshot could not be validated.",
      "无法验证请求的 repository snapshot。",
    ),
    "idea-create-failed": localize(
      language,
      "The repository was ready, but creating the idea failed.",
      "repository 已就绪，但创建 idea 失败。",
    ),
    "phase-guidance-invalid": localize(
      language,
      "The current phase guidance is invalid.",
      "当前阶段 guidance 无效。",
    ),
    "project-setup-required": localize(
      language,
      "The project requires Silvermoon setup.",
      "项目需要完成 Silvermoon 整备。",
    ),
    "repository-preparation-required": localize(
      language,
      "The local repository must be prepared before creating an idea.",
      "创建 idea 前必须先整备本地 repository。",
    ),
    "repository-sync-required": localize(
      language,
      "The repository must be synchronized before this command can continue.",
      "继续此命令前必须先同步 repository。",
    ),
  };
  return summaries[observation.state] ?? localize(
    language,
    `Command ${command} is blocked.`,
    `命令 ${command} 当前受阻。`,
  );
}

function validationResponse(intention, observation, language) {
  const valid = observation.state === "project-ready";
  return {
    kind: "validation-result",
    language,
    summary: valid
      ? localize(
        language,
        "The requested Silvermoon snapshot is valid.",
        "请求的 Silvermoon snapshot 验证通过。",
      )
      : blockedSummary(intention.command, observation, language),
    validation: {
      target: clone(intention.args.target),
      valid,
      ...(observation.version === undefined
        ? {}
        : { version: clone(observation.version) }),
    },
    problems: clone(observation.problems ?? []),
  };
}

function dialogueResponse(intention, internalObservation, language) {
  const observation = internalObservation.observation;
  const context = internalObservation.responseContext ?? {};
  const base = {
    language,
    details: observationDetails(observation),
  };
  const nextSteps = normalizeNextSteps(context.nextSteps);

  if (BLOCKED_STATES.has(observation.state)) {
    return {
      ...base,
      kind: "blocked",
      summary: blockedSummary(intention.command, observation, language),
      problems: clone(observation.problems ?? []),
      nextSteps,
      ...(observation.selectedIdea === undefined
        ? {}
        : { idea: clone(observation.selectedIdea) }),
    };
  }

  if (intention.command === "create-idea" && observation.state === "idea-created") {
    return {
      ...base,
      kind: "idea-created",
      summary: localize(
        language,
        `Created idea ${observation.createdIdea.id}.`,
        `已创建 idea ${observation.createdIdea.id}。`,
      ),
      createdIdea: clone(observation.createdIdea),
      nextSteps,
      ...(observation.guidance === undefined
        ? {}
        : { guidance: clone(observation.guidance) }),
    };
  }

  if (intention.command === "whats-next") {
    if (observation.state === "navigation-ready") {
      const choices = clone(observation.ideas?.activeIdeas ?? []);
      return {
        ...base,
        kind: "choice-required",
        summary: choices.length === 0
          ? localize(
            language,
            "Current state: navigation-ready. No active ideas are available.",
            "当前状态：navigation-ready。当前没有 active idea。",
          )
          : localize(
            language,
            `Current state: navigation-ready. ${choices.length} active idea(s) are available.`,
            `当前状态：navigation-ready。当前有 ${choices.length} 个 active idea。`,
          ),
        choices,
        nextSteps,
      };
    }
    if (observation.state === "idea-not-found") {
      return {
        ...base,
        kind: "choice-required",
        summary: localize(
          language,
          `Idea ${intention.args.idea} was not found.`,
          `未找到 idea ${intention.args.idea}。`,
        ),
        choices: clone(observation.candidates ?? []),
        problems: clone(observation.problems ?? []),
        nextSteps,
      };
    }
    if (observation.state === "idea-selected") {
      const idea = clone(observation.selectedIdea);
      return {
        ...base,
        kind: "next-steps",
        summary: localize(
          language,
          `Continue idea ${idea.alias ?? idea.id}; its state is ${idea.state}.`,
          `继续推进 idea ${idea.alias ?? idea.id}；当前状态为 ${idea.state}。`,
        ),
        idea,
        nextSteps,
        ...(observation.guidance === undefined
          ? {}
          : { guidance: clone(observation.guidance) }),
      };
    }
  }

  if (intention.command === "list-ideas" && observation.state === "ideas-listed") {
    return {
      ...base,
      kind: "idea-list",
      summary: localize(
        language,
        `Matched ${observation.summary.matched} idea(s) and returned ${observation.summary.returned}.`,
        `匹配 ${observation.summary.matched} 个 idea，返回 ${observation.summary.returned} 个。`,
      ),
      query: clone(intention.args),
      inventory: clone(observation.summary),
      items: clone(observation.ideas),
    };
  }

  throw new Error(
    `Cannot produce a response for ${intention.command}:${observation.state}`,
  );
}

export function respond(intention, internalObservation) {
  if (!intention || !internalObservation?.observation) {
    throw new Error("Response requires an intention and a final observation");
  }
  const language = responseLanguage(intention, internalObservation.observation);
  if (intention.command === "check") {
    return validationResponse(
      intention,
      internalObservation.observation,
      language,
    );
  }
  return dialogueResponse(intention, internalObservation, language);
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

function renderVersion(version) {
  if (!version) return null;
  if (version.type === "commit" || version.type === "remote") {
    return version.commit === null
      ? version.type
      : `${version.type} ${version.commit}`;
  }
  return version.type;
}

function renderGuidance(guidance, language) {
  const content = guidance.content
    .split("\n")
    .map((line) => line.length === 0 ? ">" : `> ${line}`)
    .join("\n");
  return [
    `### ${localize(language, "Project phase guidance", "项目阶段 guidance")}`,
    "",
    `- ${localize(language, "source", "来源")}: ${localize(
      language,
      "repository-owned additive guidance",
      "repository-owned 追加 guidance",
    )}`,
    `- ${localize(language, "phase", "阶段")}: ${codeSpan(guidance.phase)}`,
    `- ${localize(language, "path", "路径")}: ${codeSpan(guidance.path)}`,
    `- ${localize(language, "content revision", "内容 revision")}: ${codeSpan(guidance.contentRevision)}`,
    "",
    content,
  ].join("\n");
}

function responseTitle(response) {
  const titles = {
    blocked: ["Blocked", "受阻"],
    "choice-required": ["Choose what to continue", "选择要继续的工作"],
    "idea-created": ["Idea created", "已创建 idea"],
    "idea-list": ["Ideas", "Ideas"],
    "next-steps": ["Next steps", "下一步"],
    "validation-result": ["Check", "检查"],
  };
  const [english, chinese] = titles[response.kind] ?? ["Result", "结果"];
  return localize(response.language, english, chinese);
}

function markdownTableCell(value) {
  return String(value ?? "-")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ");
}

function renderMarkdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) =>
      `| ${row.map(markdownTableCell).join(" | ")} |`
    ),
  ];
}

function formatDate(timestamp, language, now) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) {
    throw new TypeError("Cannot render an invalid timestamp");
  }
  const duration = now.getTime() - date.getTime();
  const elapsed = Math.abs(duration);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed > 7 * day) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  if (elapsed < minute) {
    return duration < 0
      ? localize(language, "soon", "马上")
      : localize(language, "just now", "刚刚");
  }
  const [amount, unit, chineseUnit] = elapsed < hour
    ? [Math.floor(elapsed / minute), "m", "分钟"]
    : elapsed < day
      ? [Math.floor(elapsed / hour), "h", "小时"]
      : [Math.floor(elapsed / day), "d", "天"];
  return duration < 0
    ? localize(language, `in ${amount}${unit}`, `${amount}${chineseUnit}后`)
    : localize(language, `${amount}${unit} ago`, `${amount}${chineseUnit}前`);
}

function renderIdeaTable(ideas, language, now) {
  const headers = [
    "Alias / ID",
    localize(language, "State", "状态"),
    localize(language, "Created", "创建时间"),
    localize(language, "Title", "标题"),
  ];
  return renderMarkdownTable(
    headers,
    ideas.map((idea) => [
      idea.alias ?? idea.id,
      idea.state,
      formatDate(idea.createdAt, language, now),
      idea.title,
    ]),
  );
}

function renderIdeaList(response, language, now) {
  const counts = Object.entries(response.inventory.counts)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${state}=${count}`)
    .join(localize(language, ", ", "，"));
  const lines = [counts.length === 0
    ? response.summary
    : localize(
      language,
      `${response.summary} Counts: ${counts}.`,
      `${response.summary}计数：${counts}。`,
    )];
  if (response.query?.createdSince) {
    lines.push(
      `- ${localize(language, "Created since", "创建时间下界")}: ${formatDate(response.query.createdSince, language, now)}`,
    );
  }
  if (response.query?.createdBefore) {
    lines.push(
      `- ${localize(language, "Created before", "创建时间上界")}: ${formatDate(response.query.createdBefore, language, now)}`,
    );
  }
  lines.push("", ...renderIdeaTable(response.items, language, now));
  if (response.items.length === 0) {
    lines.push(
      "",
      localize(language, "No ideas matched.", "没有匹配的 idea。"),
    );
  }
  return lines.join("\n");
}

export function renderResponse(response, { now = new Date() } = {}) {
  const language = response.language ?? DEFAULT_LANGUAGE;
  if (response.kind === "idea-list") {
    return [
      `## ${responseTitle(response)}`,
      "",
      renderIdeaList(response, language, now),
    ].join("\n");
  }
  const lines = [`## ${responseTitle(response)}`, "", response.summary];

  if (response.validation) {
    const target = response.validation.target.type === "commit"
      ? `${response.validation.target.type} ${response.validation.target.revision}`
      : response.validation.target.type;
    lines.push(
      "",
      `- ${localize(language, "Target", "目标")}: ${codeSpan(target)}`,
    );
    const version = renderVersion(response.validation.version);
    if (version) {
      lines.push(`- ${localize(language, "Version", "版本")}: ${codeSpan(version)}`);
    }
    lines.push(
      `- ${localize(language, "Result", "结果")}: ${response.validation.valid
        ? localize(language, "valid", "通过")
        : localize(language, "invalid or unavailable", "未通过或无法验证")}`,
    );
  }

  if (response.idea) {
    lines.push(
      "",
      `- ${localize(language, "Idea", "Idea")}: ${codeSpan(response.idea.id)}`,
      `- ${localize(language, "State", "状态")}: ${codeSpan(response.idea.state)}`,
    );
    if (response.idea.alias !== undefined) {
      lines.push(
        `- ${localize(language, "Alias", "Alias")}: ${codeSpan(response.idea.alias)}`,
      );
    }
  }

  if (response.createdIdea) {
    lines.push(
      "",
      `- ${localize(language, "ID", "ID")}: ${codeSpan(response.createdIdea.id)}`,
      `- ${localize(language, "Path", "路径")}: ${codeSpan(response.createdIdea.path)}`,
      `- ${localize(language, "State", "状态")}: ${codeSpan(response.createdIdea.state)}`,
    );
  }

  if (response.choices) {
    lines.push(
      "",
      `### ${localize(language, "Active ideas", "Active ideas")}`,
      "",
    );
    if (response.choices.length === 0) {
      lines.push(
        localize(
          language,
          "No active ideas are available.",
          "当前没有 active idea。",
        ),
      );
    } else {
      lines.push(...renderIdeaTable(response.choices, language, now));
    }
  }

  if (response.problems?.length > 0) {
    lines.push(
      "",
      `### ${localize(language, "Issues to address", "需要处理的问题")}`,
      "",
    );
    lines.push(...renderMarkdownTable(
      [
        localize(language, "Type", "类型"),
        localize(language, "Summary", "概要"),
      ],
      response.problems.map(({ type, summary }) => [type, summary]),
    ));
  }

  if (response.nextSteps?.length > 0) {
    lines.push("", `### ${localize(language, "Next steps", "下一步")}`, "");
    for (const step of response.nextSteps) {
      lines.push(step.text);
    }
  }

  if (response.guidance !== undefined) {
    lines.push("", renderGuidance(response.guidance, language));
  }
  return lines.join("\n");
}
