import { DEFAULT_LANGUAGE, localize } from "../../project/rules/index.js";

/** @pure */
function codeSpan(value) {
  const text = String(value);
  let longest = 0;
  for (const [run] of text.matchAll(/`+/g)) {
    longest = Math.max(longest, run.length);
  }
  const fence = "`".repeat(longest + 1);
  return longest === 0 ? `${fence}${text}${fence}` : `${fence} ${text} ${fence}`;
}

/** @pure */
function renderVersion(version) {
  if (!version) return null;
  if (version.type === "commit" || version.type === "remote") {
    return version.commit === null
      ? version.type
      : `${version.type} ${version.commit}`;
  }
  return version.type;
}

/** @pure */
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

/** @pure */
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

/** @pure */
function markdownTableCell(value) {
  return String(value ?? "-")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ");
}

/** @pure */
function renderMarkdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) =>
      `| ${row.map(markdownTableCell).join(" | ")} |`
    ),
  ];
}

/** @pure */
function formatDate(timestamp, language, now, dateFacts) {
  const facts = dateFacts.get(timestamp);
  if (!facts || !Number.isFinite(facts.milliseconds) || !Number.isFinite(now.getTime())) {
    throw new TypeError("Cannot render an invalid timestamp");
  }
  const duration = now.getTime() - facts.milliseconds;
  const elapsed = Math.abs(duration);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed > 7 * day) {
    return facts.localDate;
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

/** @pure */
function renderIdeaTable(ideas, language, now, dateFacts) {
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
      formatDate(idea.createdAt, language, now, dateFacts),
      idea.title,
    ]),
  );
}

/** @pure */
function renderIdeaList(response, language, now, dateFacts) {
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
      `- ${localize(language, "Created since", "创建时间下界")}: ${formatDate(response.query.createdSince, language, now, dateFacts)}`,
    );
  }
  if (response.query?.createdBefore) {
    lines.push(
      `- ${localize(language, "Created before", "创建时间上界")}: ${formatDate(response.query.createdBefore, language, now, dateFacts)}`,
    );
  }
  lines.push("", ...renderIdeaTable(response.items, language, now, dateFacts));
  if (response.items.length === 0) {
    lines.push(
      "",
      localize(language, "No ideas matched.", "没有匹配的 idea。"),
    );
  }
  return lines.join("\n");
}

/** @pure */
export function renderMarkdownResponse(response, { now, dateFacts }) {
  const language = response.language ?? DEFAULT_LANGUAGE;
  if (response.kind === "idea-list") {
    return [
      `## ${responseTitle(response)}`,
      "",
      renderIdeaList(response, language, now, dateFacts),
    ].join("\n");
  }
  const lines = [`## ${responseTitle(response)}`, "", response.summary];

  if (response.receipt) lines.push("", "```json", JSON.stringify(response.receipt, null, 2), "```");
  if (response.validation) {
    const target = response.validation.target.type === "commit"
      ? `${response.validation.target.type} ${response.validation.target.revision}`
      : response.validation.target.type;
    lines.push(
      "",
      `- ${localize(language, "Target", "目标")}: ${codeSpan(target)}`,
    );
    if (response.validation.eventHistory) {
      lines.push("", "```json", JSON.stringify(response.validation.eventHistory, null, 2), "```");
    }
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
      lines.push(...renderIdeaTable(response.choices, language, now, dateFacts));
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
