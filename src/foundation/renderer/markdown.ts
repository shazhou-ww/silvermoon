import { DEFAULT_LANGUAGE, localize } from "../language/index.ts";
import type {
  DateFacts,
  DeviceAdvisory,
  Guidance,
  IdeaInventoryItem,
  IdeaReference,
  IdeaListResponse,
  ProjectSchemaReadiness,
  ProjectVersion,
  ReportResponse,
  ReviewContext,
} from "../report/types.ts";

/** @pure */
function codeSpan(value: string) {
  const text = String(value);
  let longest = 0;
  for (const [run] of text.matchAll(/`+/g)) {
    longest = Math.max(longest, run.length);
  }
  const fence = "`".repeat(longest + 1);
  return longest === 0 ? `${fence}${text}${fence}` : `${fence} ${text} ${fence}`;
}

/** @pure */
function objectReference(value: string) {
  return value.slice(0, 12);
}

/** @pure */
function objectiveName(
  objective: "device" | "project" | "idea",
  language: string,
) {
  const names = {
    device: ["Device readiness", "设备整备"],
    project: ["Project readiness", "项目整备"],
    idea: ["Idea progress", "Idea 推进"],
  } as const;
  const [english, chinese] = names[objective];
  return localize(language, english, chinese);
}

/** @pure */
function objectiveGoal(
  objective: "device" | "project" | "idea",
  language: string,
) {
  if (language !== "zh-CN") {
    return objectiveName(objective, language);
  }
  return {
    device: "完成设备整备",
    project: "完成项目整备",
    idea: "推进 Idea",
  }[objective];
}

/** @pure */
function objectiveStatus(
  objective: NonNullable<ReportResponse["objective"]>,
  language: string,
) {
  const target = objectiveGoal(objective.target, language);
  const owner = objectiveName(objective.owner, language);
  if (objective.terminal) {
    return localize(
      language,
      `This observation confirms that ${owner} is complete.`,
      `本次观测确认${owner}已完成。`,
    );
  }
  const blocked = objective.problems.length === 1
    ? localize(language, "The problem below is", "下方问题")
    : localize(language, "The problems below are", "下方问题");
  if (objective.target === objective.owner) {
    return localize(
      language,
      `This request targets ${target}. ${blocked} preventing it from continuing.`,
      `本次请求的目标是${target}。${blocked}阻止继续推进。`,
    );
  }
  return localize(
    language,
    `This request targets ${target}, but ${owner} must be completed first. ${blocked} preventing ${owner} from continuing.`,
    `本次请求的目标是${target}，但必须先完成${owner}。${blocked}阻止${owner}继续。`,
  );
}

/** @pure */
function parameterLabel(problemId: string, key: string, language: string) {
  const problemLabels: Readonly<Record<string, Readonly<Record<string, readonly [string, string]>>>> = {
    "device-runtime": {
      source: ["Runtime source", "Runtime 来源"],
      version: ["Runtime version", "Runtime 版本"],
    },
  };
  const commonLabels: Readonly<Record<string, readonly [string, string]>> = {
    branch: ["Observed branch", "观测到的分支"],
    configurationPath: ["Configuration path", "配置路径"],
    head: ["Observed HEAD", "观测到的 HEAD"],
    lifecycleState: ["Idea lifecycle state", "Idea 生命周期状态"],
    path: ["Affected path", "受影响路径"],
    paths: ["Affected paths", "受影响路径"],
    phase: ["Idea phase", "Idea 阶段"],
    primary: ["Observed primary", "观测到的 primary"],
    problemTypes: ["Observed problem types", "观测到的问题类型"],
    requirement: ["Required state", "要求状态"],
    revision: ["Observed revision", "观测到的 revision"],
    root: ["Observed root", "观测根目录"],
    state: ["Observed state", "观测状态"],
    status: ["Observed status", "观测状态"],
  };
  const label = problemLabels[problemId]?.[key] ?? commonLabels[key];
  if (label !== undefined) return localize(language, ...label);
  const readable = key
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[-_]+/g, " ")
    .toLowerCase();
  return localize(
    language,
    readable.replace(/^./, (character) => character.toUpperCase()),
    `观测值 ${key}`,
  );
}

/** @pure */
function parameterValue(
  value: NonNullable<ReportResponse["objective"]>["problems"][number]["parameters"][string],
  language: string,
) {
  if (value === null) return localize(language, "not observed", "未观测到");
  if (Array.isArray(value)) {
    return value.length === 0
      ? localize(language, "none", "无")
      : value.map((entry) =>
        typeof entry === "object" && entry !== null
          ? codeSpan(JSON.stringify(entry))
          : codeSpan(String(entry))
      ).join(", ");
  }
  return typeof value === "object"
    ? codeSpan(JSON.stringify(value))
    : codeSpan(String(value));
}

/** @pure */
function problemFacts(
  problem: NonNullable<ReportResponse["objective"]>["problems"][number],
  language: string,
) {
  if (problem.id === "device-runtime") {
    const runtimePath = problem.parameters.runtimePath;
    const source = problem.parameters.source;
    const version = problem.parameters.version;
    if (typeof runtimePath === "string") {
      const sourceSuffix = source === "source-checkout"
        ? localize(language, " (source checkout)", "（source checkout）")
        : "";
      const versionSuffix = typeof version === "string"
        ? localize(
          language,
          `, version ${codeSpan(version)}`,
          `，版本 ${codeSpan(version)}`,
        )
        : "";
      return [
        `   - ${localize(language, "Current runtime", "当前 runtime")}: ${
          codeSpan(runtimePath)
        }${sourceSuffix}${versionSuffix}`,
      ];
    }
  }
  return Object.entries(problem.parameters).map(([key, value]) =>
    `   - ${parameterLabel(problem.id, key, language)}: ${
      parameterValue(value, language)
    }`
  );
}

/** @pure */
function renderVersion(version?: ProjectVersion) {
  if (!version) return null;
  if (version.type === "commit" || version.type === "remote") {
    return version.commit === null
      ? version.type
      : `${version.type} ${version.commit}`;
  }
  return version.type;
}

/** @pure */
function renderGuidance(guidance: Guidance, language: string) {
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
function responseTitle(response: ReportResponse) {
  const titles: Record<string, readonly [string, string]> = {
    blocked: ["Blocked", "受阻"],
    "choice-required": ["Choose what to continue", "选择要继续的工作"],
    "idea-created": ["Idea created", "已创建 idea"],
    "idea-list": ["Ideas", "Ideas"],
    "next-steps": ["Next steps", "下一步"],
    objective: ["Objective", "Objective"],
    "validation-result": ["Check", "检查"],
  };
  const [english, chinese] = titles[response.kind] ?? ["Result", "结果"];
  return localize(response.language, english, chinese);
}

/** @pure */
function markdownTableCell(value: string | number | null | undefined) {
  return String(value ?? "-")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ");
}

/** @pure */
function renderMarkdownTable(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) =>
      `| ${row.map(markdownTableCell).join(" | ")} |`
    ),
  ];
}

/** @pure */
function renderReview(
  review: ReviewContext,
  language: string,
) {
  const { presentation } = review;
  const templateInstruction = presentation.requiresLocalization
    ? localize(
      language,
      `Use the following template to request the user's review. Localize all human-visible template text to ${presentation.contentLanguage}, replace only brace-delimited placeholders and link targets, and preserve machine identifiers.`,
      `必须按照以下模板提请用户审阅。把所有面向用户的模板文本本地化为 ${presentation.contentLanguage}，仅替换花括号占位值和链接目标，并保留机器标识。`,
    )
    : localize(
      language,
      "Use the following template to request the user's review. Replace only brace-delimited placeholders and link targets; preserve all other text verbatim.",
      "必须按照以下模板提请用户审阅。仅替换花括号占位值和链接目标；其余文本必须逐字保留。",
    );
  return [
    `### ${localize(language, "Review request template", "审阅请求模板")}`,
    "",
    templateInstruction,
    "",
    "```markdown",
    `## ${presentation.gateLabel}`,
    "",
    `- ${presentation.labels.idea}: {idea identity}`,
    `- ${presentation.labels.candidate}: ${codeSpan(`${review.revision.field}=${objectReference(review.revision.value)}`)} ${presentation.candidateConnector} ${codeSpan(objectReference(review.primaryCommit))}`,
    `- ${presentation.labels.reviewFocus}: {one-sentence review focus}`,
    `- ${presentation.labels.reviewFiles}:`,
    ...review.canonicalDocuments.map(({ role, path }) =>
      `  - ${presentation.documentLabels[role]}: [${presentation.labels.local}]({host-clickable local link for ${path}}) · [${presentation.labels.remote}]({immutable primary link for ${path}})`
    ),
    `- ${presentation.labels.decision}: ${presentation.decisionQuestion}`,
    "```",
  ];
}

/** @pure */
function renderIdeaCoordination(idea: IdeaReference, language: string) {
  const lines: string[] = [];
  if (idea.eventDigest !== undefined) {
    lines.push(
      `- ${localize(language, "Event digest", "事件 digest")}: ${codeSpan(idea.eventDigest)}`,
    );
  }
  if (idea.control !== undefined) {
    const transfer = idea.control.lastTransfer === null
      ? localize(language, "initial assignment", "初始分配")
      : `${idea.control.lastTransfer.type}#${idea.control.lastTransfer.sequence}`;
    lines.push(
      `- ${localize(language, "Control", "控制权")}: ${codeSpan(idea.control.owner)}`,
      `- ${localize(language, "Last transfer", "最近交接")}: ${codeSpan(transfer)}`,
    );
  }
  if (idea.submissions !== undefined) {
    const submissions = [
      idea.submissions.ideal,
      idea.submissions.inner,
      idea.submissions.outer,
    ];
    lines.push(
      "",
      `### ${localize(language, "Phase submissions", "阶段提交")}`,
      "",
      ...renderMarkdownTable(
        [
          localize(language, "Phase", "阶段"),
          "Submit",
          localize(language, "State", "状态"),
          localize(language, "Revision reference", "修订引用"),
        ],
        submissions.map((submission) => [
          submission.phase,
          submission.submit,
          submission.state,
          `${submission.revision.field}=${objectReference(submission.revision.value)}`,
        ]),
      ),
    );
  }
  return lines;
}

/** @pure */
function formatDate(
  timestamp: string,
  language: string,
  now: Date,
  dateFacts: Map<string, DateFacts>,
) {
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
function renderIdeaTable(
  ideas: IdeaInventoryItem[],
  language: string,
  now: Date,
  dateFacts: Map<string, DateFacts>,
) {
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
function renderIdeaList(
  response: IdeaListResponse,
  language: string,
  now: Date,
  dateFacts: Map<string, DateFacts>,
) {
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
function renderDeviceAdvisory(
  device: DeviceAdvisory,
  language: string,
) {
  const runtimeNeedsAttention =
    device.runtime.source === "source-checkout"
    || device.runtime.summary !== undefined;
  const skillNeedsAttention =
    !["ready", "managed-by-host"].includes(device.skill.status)
    || device.skill.remediation !== undefined
    || device.skill.summary !== undefined
    || (device.skill.invalidPaths?.length ?? 0) > 0;
  const updateNeedsAttention =
    !["current", "not-required", "managed-by-host"].includes(device.update.status)
    || (
      device.update.status === "current"
      && device.update.summary !== undefined
    );
  if (
    !runtimeNeedsAttention
    && !skillNeedsAttention
    && !updateNeedsAttention
  ) {
    return [];
  }
  if (device.runtime.source === "source-checkout") {
    return [
      `### ${localize(
        language,
        "Device advisory (does not affect the project result)",
        "设备提示（不影响项目判断）",
      )}`,
      "",
      `- ${localize(language, "Problem", "问题")}: ${localize(
        language,
        "This command did not run through a device-level `silvermoon` executable discoverable on `PATH`.",
        "当前命令未通过 `PATH` 中可发现的设备级 `silvermoon` 可执行文件运行。",
      )}`,
      `- ${localize(language, "Required action", "必要动作")}: ${localize(
        language,
        "Run `pnpm setup:dev` from this Silvermoon source checkout, ensure the global npm bin directory is on `PATH`, then rerun the same command with `silvermoon`.",
        "在当前 Silvermoon source checkout 中运行 `pnpm setup:dev`，确保 npm global bin 目录已加入 `PATH`，然后用 `silvermoon` 重试当前命令。",
      )}`,
    ];
  }
  const skillDetails = device.skill.summary
    ?? (device.skill.invalidPaths?.length
      ? device.skill.invalidPaths.join(", ")
      : device.skill.paths.length > 0
        ? device.skill.paths.join(", ")
        : device.skill.expectedRoot);
  const skillDescription = device.skill.remediation === undefined
    ? skillDetails
    : `${skillDetails}; ${device.skill.remediation}`;
  const updateChannel = device.update.channel ?? "latest";
  const updateLabel = updateChannel === "latest"
    ? localize(language, "Latest runtime", "最新 runtime")
    : `${updateChannel[0]?.toUpperCase() ?? ""}${updateChannel.slice(1)} runtime`;
  const updateDetails = [
    device.update.currentVersion === null
      ? null
      : `current=${device.update.currentVersion}`,
    device.update.latestVersion === undefined
      ? null
      : `${updateChannel}=${device.update.latestVersion}`,
    device.update.checkedAt === undefined
      ? null
      : `checked=${device.update.checkedAt}`,
    `source=${device.update.source}`,
    device.update.summary,
  ].filter((value): value is string => value !== null && value !== undefined);
  const lines = [
    `### ${localize(
      language,
      "Device advisory (does not affect the project result)",
      "设备提示（不影响项目判断）",
    )}`,
    "",
    ...renderMarkdownTable(
      [
        localize(language, "Check", "检查项"),
        localize(language, "Status", "状态"),
        localize(language, "Details", "详情"),
      ],
      [
        [
          localize(language, "Runtime", "Runtime"),
          device.runtime.source,
          [
            device.runtime.version ?? "-",
            device.runtime.summary,
          ].filter(Boolean).join("; "),
        ],
        [
          localize(language, "Personal skill", "个人级 skill"),
          device.skill.status,
          skillDescription,
        ],
        [
          updateLabel,
          device.update.status,
          updateDetails.join("; "),
        ],
      ],
    ),
  ];
  return lines;
}

/** @pure */
function renderSchemaReadiness(
  schemas: ProjectSchemaReadiness,
  language: string,
) {
  const files = schemas.files.filter(({ readiness, validity }) =>
    readiness !== "current" || validity !== "valid"
  );
  if (files.length === 0) return [];
  return [
    `### ${localize(
      language,
      "Project schema preparation",
      "项目 schema 整备",
    )}`,
    "",
    ...renderMarkdownTable(
      [
        localize(language, "Path", "路径"),
        localize(language, "Family", "Schema family"),
        localize(language, "Declared", "声明版本"),
        localize(language, "Target", "目标版本"),
        localize(language, "Validity", "有效性"),
        localize(language, "Readiness", "整备状态"),
        localize(language, "Details", "详情"),
      ],
      files.map((file) => [
        file.path,
        file.family,
        file.schemaVersion,
        file.targetVersion,
        file.validity,
        file.readiness,
        file.message ?? file.migrationPath?.map(({ id }) => id).join(" -> "),
      ]),
    ),
  ];
}

/** @pure */
function renderObjectiveResponse(response: ReportResponse, language: string) {
  const objective = response.objective;
  if (objective === undefined) {
    throw new TypeError("Objective report requires an Objective projection.");
  }
  const lines = [
    `## ${objectiveName(objective.target, language)}`,
    "",
    `### ${objective.terminal
      ? localize(language, "Outcome", "结果")
      : localize(language, "Current status", "现状")}`,
    "",
    objectiveStatus(objective, language),
  ];
  const root = response.details?.root;
  const version = renderVersion(response.details?.version);
  const primary = response.details?.primary;
  if (root !== undefined || version !== null || primary !== undefined) {
    const context = [
      ...(root === undefined
        ? []
        : [`${localize(language, "root", "根目录")} ${codeSpan(root)}`]),
      ...(version === null
        ? []
        : [`${localize(language, "revision", "revision")} ${codeSpan(version)}`]),
      ...(primary === undefined
        ? []
        : [`primary ${codeSpan(`${primary.repository}#${primary.branch}`)}`]),
    ];
    lines.push(
      "",
      `${localize(language, "Observation context", "观测上下文")}: ${
        context.join(localize(language, ", ", "，"))
      }${localize(language, ".", "。")}`,
    );
  }
  if (response.schemas !== undefined) {
    const readiness = renderSchemaReadiness(response.schemas, language);
    if (readiness.length > 0) {
      lines.push("", ...readiness.map((line) => line.replace(/^### /, "#### ")));
    }
  }
  if ("idea" in response && response.idea !== undefined) {
    const identity = response.idea.alias === undefined
      ? codeSpan(response.idea.id)
      : `${response.idea.alias} (${codeSpan(response.idea.id)})`;
    lines.push(
      "",
      `${localize(language, "Selected Idea", "所选 Idea")}: ${identity}; ${
        localize(language, "lifecycle state", "生命周期状态")
      } ${codeSpan(response.idea.state)}.`,
    );
    lines.push(
      ...renderIdeaCoordination(response.idea, language)
        .map((line) => line.replace(/^### /, "#### ")),
    );
  }
  if (objective.problems.length > 0) {
    lines.push(
      "",
      `### ${localize(language, "Problems", "问题")}`,
      "",
    );
    for (const [index, problem] of objective.problems.entries()) {
      const reference = objective.references.find(
        ({ id, kind }) => kind === "problem" && id === `problems/${problem.id}`,
      );
      lines.push(
        `${index + 1}. ${reference?.description ?? reference?.title ?? codeSpan(problem.id)}`,
        ...problemFacts(problem, language),
      );
    }
  }
  const hasNextAction = (response.kind === "next-steps" && response.review !== undefined)
    || ("nextSteps" in response && response.nextSteps.length > 0)
    || ("guidance" in response && response.guidance !== undefined);
  if (hasNextAction) {
    lines.push(
      "",
      `### ${localize(language, "Next action", "下一步动作")}`,
      "",
    );
  }
  if (response.kind === "next-steps" && response.review !== undefined) {
    lines.push(
      ...renderReview(response.review, language)
        .map((line) => line.replace(/^### /, "#### ")),
      "",
    );
  }
  if ("nextSteps" in response && response.nextSteps.length > 0) {
    lines.push(
      ...response.nextSteps.map(({ text }) => text),
    );
  }
  if ("guidance" in response && response.guidance !== undefined) {
    lines.push(
      "",
      renderGuidance(response.guidance, language).replace(/^### /gm, "#### "),
    );
  }
  lines.push(
    "",
    `### ${localize(language, "References", "参考资料")}`,
    "",
  );
  for (const reference of objective.references) {
    const kind = {
      level: localize(language, "Level", "层级"),
      check: "Check",
      problem: "Problem",
    }[reference.kind];
    lines.push(
      `- ${kind}: ${reference.title} (${codeSpan(reference.id)}) — ${
        localize(language, "further details", "进一步详情")
      }: ${codeSpan(reference.command)}`,
    );
  }
  return lines.join("\n");
}

/** @pure */
export function renderMarkdownResponse(
  response: ReportResponse,
  { now, dateFacts }: { now: Date; dateFacts: Map<string, DateFacts> },
) {
  const language = response.language ?? DEFAULT_LANGUAGE;
  if (response.objective !== undefined) {
    return renderObjectiveResponse(response, language);
  }
  if (response.kind === "idea-list") {
    const sections = [
      `## ${responseTitle(response)}`,
      "",
      renderIdeaList(response, language, now, dateFacts),
    ];
    if (response.schemas !== undefined) {
      const readiness = renderSchemaReadiness(response.schemas, language);
      if (readiness.length > 0) sections.push("", ...readiness);
    }
    if (response.device !== undefined) {
      const advisory = renderDeviceAdvisory(response.device, language);
      if (advisory.length > 0) sections.push("", ...advisory);
    }
    return sections.join("\n");
  }
  const lines = [`## ${responseTitle(response)}`, "", response.summary];
  if (response.schemas !== undefined) {
    const readiness = renderSchemaReadiness(response.schemas, language);
    if (readiness.length > 0) lines.push("", ...readiness);
  }
  if (response.device !== undefined) {
    const advisory = renderDeviceAdvisory(response.device, language);
    if (advisory.length > 0) lines.push("", ...advisory);
  }

  if (response.kind === "event-result") {
    lines.push("", "```json", JSON.stringify(response.receipt, null, 2), "```");
  }
  if (response.kind === "validation-result") {
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

  if ("idea" in response && response.idea !== undefined) {
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
    lines.push(...renderIdeaCoordination(response.idea, language));
  }

  if (response.kind === "next-steps" && response.review !== undefined) {
    lines.push("", ...renderReview(response.review, language));
  }

  if (response.kind === "idea-created") {
    lines.push(
      "",
      `- ${localize(language, "ID", "ID")}: ${codeSpan(response.createdIdea.id)}`,
      `- ${localize(language, "Path", "路径")}: ${codeSpan(response.createdIdea.path)}`,
      `- ${localize(language, "State", "状态")}: ${codeSpan(response.createdIdea.state)}`,
    );
  }

  if (response.kind === "choice-required") {
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

  if ("problems" in response && response.problems !== undefined && response.problems.length > 0) {
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

  if ("nextSteps" in response && response.nextSteps.length > 0) {
    lines.push("", `### ${localize(language, "Next steps", "下一步")}`, "");
    for (const step of response.nextSteps) {
      lines.push(step.text);
    }
  }

  if ("guidance" in response && response.guidance !== undefined) {
    lines.push("", renderGuidance(response.guidance, language));
  }
  return lines.join("\n");
}
