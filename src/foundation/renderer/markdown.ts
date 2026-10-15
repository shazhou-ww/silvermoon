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
  if (objective.target === objective.owner) {
    return localize(
      language,
      `This request targets ${target}.`,
      `本次请求的目标是${target}。`,
    );
  }
  return localize(
    language,
    `This request targets ${target}, but ${owner} must be completed first.`,
    `本次请求的目标是${target}，但必须先完成${owner}。`,
  );
}

/** @pure */
function stringValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** @pure */
function proseFacts(lines: string[]) {
  return lines.map((line) => `   ${line}`);
}

/** @pure */
function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
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
      const checkoutPath = problem.parameters.checkoutPath;
      const checkoutSuffix = source === "source-checkout"
          && typeof checkoutPath === "string"
        ? localize(
          language,
          `; its source checkout root is ${codeSpan(checkoutPath)}`,
          `；对应的 source checkout 根目录是 ${codeSpan(checkoutPath)}`,
        )
        : "";
      return proseFacts([
        localize(
          language,
          `The active runtime is ${codeSpan(runtimePath)}${sourceSuffix}${versionSuffix}${checkoutSuffix}.`,
          `当前 runtime 是 ${codeSpan(runtimePath)}${sourceSuffix}${versionSuffix}${checkoutSuffix}。`,
        ),
      ]);
    }
  }

  if (problem.id.startsWith("device-configuration")) {
    const path = problem.parameters.configurationPath;
    const codes = stringValues(problem.parameters.diagnosticCodes);
    if (typeof path === "string") {
      const observedVersion = problem.parameters.observedVersion;
      const supportedVersion = problem.parameters.supportedVersion;
      if (problem.id === "device-configuration-historical-version") {
        return proseFacts([
          localize(
            language,
            `The device configuration at ${codeSpan(path)} uses historical version ${codeSpan(String(observedVersion))}; this runtime supports version ${codeSpan(String(supportedVersion))}.`,
            `位于 ${codeSpan(path)} 的设备配置使用历史版本 ${codeSpan(String(observedVersion))}；当前 runtime 支持版本 ${codeSpan(String(supportedVersion))}。`,
          ),
        ]);
      }
      if (problem.id === "device-configuration-future-version") {
        const runtimeVersion = problem.parameters.runtimeVersion;
        const latestVersion = problem.parameters.latestVersion;
        return proseFacts([
          localize(
            language,
            `The device configuration at ${codeSpan(path)} uses version ${codeSpan(String(observedVersion))}, which binary ${codeSpan(String(runtimeVersion))} does not support; it supports version ${codeSpan(String(supportedVersion))}. The npm registry reports newer Silvermoon CLI version ${codeSpan(String(latestVersion))}.`,
            `位于 ${codeSpan(path)} 的设备配置使用版本 ${codeSpan(String(observedVersion))}，binary ${codeSpan(String(runtimeVersion))} 不支持该版本；它支持版本 ${codeSpan(String(supportedVersion))}。npm registry 报告有更新的 Silvermoon CLI 版本 ${codeSpan(String(latestVersion))}。`,
          ),
        ]);
      }
      if (problem.id === "device-configuration-invalid-version") {
        const runtimeVersion = problem.parameters.runtimeVersion;
        const updateStatus = problem.parameters.updateStatus;
        return proseFacts([
          updateStatus === "current"
            ? localize(
              language,
              `The device configuration at ${codeSpan(path)} declares unsupported version ${codeSpan(String(observedVersion))}. The npm registry confirms binary version ${codeSpan(String(runtimeVersion))} is current, so this configuration version is wrong rather than awaiting a CLI update; the supported version is ${codeSpan(String(supportedVersion))}.`,
              `位于 ${codeSpan(path)} 的设备配置声明了不受支持的版本 ${codeSpan(String(observedVersion))}。npm registry 确认 binary 版本 ${codeSpan(String(runtimeVersion))} 已是最新，因此这是配置版本号错误，而不是等待 CLI 更新；当前支持版本为 ${codeSpan(String(supportedVersion))}。`,
            )
            : localize(
              language,
              `The device configuration at ${codeSpan(path)} does not declare a valid supported version; the current version is ${codeSpan(String(supportedVersion))}.`,
              `位于 ${codeSpan(path)} 的设备配置没有声明合法的受支持版本；当前版本为 ${codeSpan(String(supportedVersion))}。`,
            ),
        ]);
      }
      const detail = codes.includes("user-config.unsupported-version")
        ? localize(
          language,
          "uses an unsupported version; this runtime expects `version: 1`",
          "使用了当前 runtime 不支持的版本；这里要求 `version: 1`",
        )
        : codes.includes("user-config.missing-version")
        ? localize(
          language,
          "does not declare the required `version: 1`",
          "缺少必需的 `version: 1`",
        )
        : localize(
          language,
          "does not satisfy the current user-configuration contract",
          "不满足当前个人配置 contract",
        );
      const diagnosticMessages = Array.isArray(problem.parameters.diagnostics)
        ? problem.parameters.diagnostics.flatMap((value) => {
          const record = recordValue(value);
          if (record === undefined) return [];
          const code = record.code;
          const diagnosticPath = record.path;
          const field = typeof diagnosticPath === "string"
            ? diagnosticPath.replace(/^.*#/, "")
            : "";
          if (code === "user-config.invalid-yaml") {
            return [localize(language, "the file is not valid strict YAML", "文件不是合法的 strict YAML")];
          }
          if (code === "user-config.invalid-type") {
            return [localize(language, "the top level must be a YAML mapping", "顶层必须是 YAML mapping")];
          }
          if (code === "user-config.unknown-key") {
            return [localize(
              language,
              `unsupported field ${codeSpan(field)}`,
              `包含不允许的字段 ${codeSpan(field)}`,
            )];
          }
          if (code === "user-config.missing-version") {
            return [localize(language, "the required `version` field is missing", "缺少必需的 `version` 字段")];
          }
          if (code === "user-config.invalid-preferred-language") {
            return [localize(
              language,
              "`preferredLanguage` is not a canonical BCP 47 language tag",
              "`preferredLanguage` 不是 canonical BCP 47 language tag",
            )];
          }
          if (code === "user-config.noncanonical") {
            return [localize(
              language,
              "field order or line endings are not canonical",
              "字段顺序或换行格式不是 canonical 格式",
            )];
          }
          if (code === "user-config.invalid-file") {
            return [localize(language, "the path is not a readable regular file", "该路径不是可读取的普通文件")];
          }
          return typeof record.message === "string" ? [record.message] : [];
        })
        : [];
      return proseFacts([
        localize(
          language,
          `The device configuration at ${codeSpan(path)} ${detail}${
            diagnosticMessages.length === 0 ? "" : `: ${diagnosticMessages.join("; ")}`
          }.`,
          `位于 ${codeSpan(path)} 的设备配置${detail}${
            diagnosticMessages.length === 0 ? "" : `：${diagnosticMessages.join("；")}`
          }。`,
        ),
      ]);
    }
  }

  if (
    problem.id === "device-skill"
    || problem.id === "device-canonical-skill"
  ) {
    const status = problem.parameters.status;
    const expectedRoot = problem.parameters.expectedRoot;
    const expectedRevision = problem.parameters.expectedRevision;
    const observed = Array.isArray(problem.parameters.observed)
      ? problem.parameters.observed.flatMap((value) => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
        const path = value.path;
        const revision = value.revision;
        return typeof path === "string"
          ? [{ path, revision: typeof revision === "string" ? revision : null }]
          : [];
      })
      : [];
    if (typeof expectedRoot === "string") {
      if (status === "canonical-unverifiable") {
        return proseFacts([
          localize(
            language,
            `The active runtime's canonical Silvermoon skill at ${codeSpan(expectedRoot)} could not be verified.`,
            `无法验证 active runtime 位于 ${codeSpan(expectedRoot)} 的 canonical Silvermoon skill。`,
          ),
        ]);
      }
      if (status === "missing") {
        return proseFacts([
          localize(
            language,
            `No personal Silvermoon skill was found. The active runtime's canonical skill at ${codeSpan(expectedRoot)} has content revision ${codeSpan(String(expectedRevision))}.`,
            `未发现个人级 Silvermoon skill。active runtime 位于 ${codeSpan(expectedRoot)} 的 canonical skill 内容 revision 为 ${codeSpan(String(expectedRevision))}。`,
          ),
        ]);
      }
      const observations = observed.map(({ path, revision }) =>
        revision === null
          ? localize(language, `${codeSpan(path)} could not be read or has invalid structure`, `${codeSpan(path)} 无法读取或结构无效`)
          : localize(language, `${codeSpan(path)} has revision ${codeSpan(revision)}`, `${codeSpan(path)} 的 revision 为 ${codeSpan(revision)}`)
      ).join(localize(language, "; ", "；"));
      return proseFacts([
        localize(
          language,
          `A personal Silvermoon skill was found, but its content revision does not match the active runtime's expected revision ${codeSpan(String(expectedRevision))}${observations === "" ? "" : `: ${observations}`}.`,
          `已发现个人级 Silvermoon skill，但其内容 revision 与 active runtime 期望的 ${codeSpan(String(expectedRevision))} 不一致${observations === "" ? "" : `：${observations}`}。`,
        ),
      ]);
    }
  }

  if (problem.id === "device-update") {
    const current = problem.parameters.currentVersion;
    const latest = problem.parameters.latestVersion;
    const channel = problem.parameters.channel;
    if (typeof current === "string" && typeof latest === "string") {
      return proseFacts([
        localize(
          language,
          `The device runtime is ${codeSpan(current)}, while the ${
            typeof channel === "string" ? codeSpan(channel) : "installed"
          } channel reports ${codeSpan(latest)}.`,
          `设备级 runtime 当前为 ${codeSpan(current)}，而 ${
            typeof channel === "string" ? codeSpan(channel) : "对应"
          } channel 报告的版本是 ${codeSpan(latest)}。`,
        ),
      ]);
    }
  }

  if ([
    "project-configuration",
    "project-user-configuration",
    "project-layout",
    "project-adoption",
    "project-schema",
  ].includes(problem.id)) {
    const types = stringValues(problem.parameters.problemTypes);
    const facts = types.flatMap((type) => {
      if (type === "schema-invalid") {
        return [localize(
          language,
          "Project metadata contains a value that does not satisfy a supported schema.",
          "项目 metadata 中存在不满足受支持 schema 的值。",
        )];
      }
      if (type === "project-metadata-missing") {
        return [localize(
          language,
          "The Silvermoon project metadata directory `.silvermoon` is missing.",
          "Silvermoon 项目 metadata 目录 `.silvermoon` 缺失。",
        )];
      }
      if (type === "project-metadata-invalid") {
        return [localize(
          language,
          "The `.silvermoon` project metadata path is not a directory.",
          "项目 metadata 路径 `.silvermoon` 不是目录。",
        )];
      }
      if (type === "config-invalid-yaml") {
        return [localize(
          language,
          "The project configuration `.silvermoon/config.yaml` is not valid strict YAML.",
          "项目配置 `.silvermoon/config.yaml` 不是合法的 strict YAML。",
        )];
      }
      if (type.includes("config-missing")) {
        return [localize(
          language,
          "The project configuration `.silvermoon/config.yaml` is missing.",
          "项目配置 `.silvermoon/config.yaml` 缺失。",
        )];
      }
      if (type.includes("not-adopted")) {
        return [localize(
          language,
          "The repository does not contain the complete Silvermoon project metadata required for adoption.",
          "该 repository 缺少完成 Silvermoon project adoption 所需的完整 metadata。",
        )];
      }
      if (type.startsWith("user-")) {
        return [localize(
          language,
          "The personal Silvermoon configuration prevents the complete project snapshot from being resolved.",
          "个人级 Silvermoon 配置导致完整项目 snapshot 无法解析。",
        )];
      }
      if (type.startsWith("idea-") || type.startsWith("layout-")) {
        return [localize(
          language,
          "The Idea directory layout or metadata is incomplete or invalid.",
          "Idea 目录 layout 或 metadata 不完整或无效。",
        )];
      }
      if (
        type.includes("migration")
        || type.includes("runtime-upgrade")
        || type.includes("runtime-refresh")
      ) {
        return [localize(
          language,
          "Project metadata requires a supported migration or runtime before Idea work can continue.",
          "项目 metadata 需要受支持的 migration 或 runtime，之后才能继续 Idea 工作。",
        )];
      }
      return [];
    });
    return proseFacts([...new Set(facts)]);
  }

  if (
    problem.id.startsWith("repository-")
    || (problem.id === "project-primary-guidance"
      && Array.isArray(problem.parameters.problemTypes))
  ) {
    const types = stringValues(problem.parameters.problemTypes);
    const expectedRepository = problem.parameters.expectedRepository;
    const expectedBranch = problem.parameters.expectedBranch;
    const branch = recordValue(problem.parameters.branch);

    if (types.includes("worktree-changes") || types.includes("worktree-conflicts")) {
      const changes = recordValue(problem.parameters.changes);
      if (changes !== undefined) {
        const labels: Readonly<Record<string, readonly [string, string]>> = {
          conflicted: ["conflicted", "冲突"],
          staged: ["staged", "已暂存"],
          unstaged: ["unstaged", "未暂存"],
          untracked: ["untracked", "未跟踪"],
        };
        const observed = Object.entries(labels).flatMap(([key, label]) =>
          stringValues(changes[key]).map((path) =>
            localize(
              language,
              `${label[0]} ${codeSpan(path)}`,
              `${label[1]}的 ${codeSpan(path)}`,
            )
          )
        );
        if (observed.length > 0) {
          return proseFacts([
            localize(
              language,
              `The worktree contains ${observed.join(", ")}; these changes must be given an intentional disposition before Idea work continues.`,
              `工作区包含${observed.join("、")}；继续 Idea 工作前，需要为这些修改确定明确去向。`,
            ),
          ]);
        }
      }
    }

    if (types.includes("detached-head")) {
      const head = problem.parameters.head;
      return proseFacts([
        localize(
          language,
          `HEAD${typeof head === "string" ? ` ${codeSpan(head.slice(0, 12))}` : ""} is detached, so the current work is not attached to a local branch${
            typeof expectedRepository === "string" && typeof expectedBranch === "string"
              ? ` tracking ${codeSpan(`${expectedRepository}#${expectedBranch}`)}`
              : ""
          }.`,
          `HEAD${typeof head === "string" ? ` ${codeSpan(head.slice(0, 12))}` : ""} 处于 detached 状态，因此当前工作未附着到${
            typeof expectedRepository === "string" && typeof expectedBranch === "string"
              ? `跟踪 ${codeSpan(`${expectedRepository}#${expectedBranch}`)} 的`
              : ""
          }本地分支。`,
        ),
      ]);
    }

    if (types.includes("primary-upstream-mismatch")) {
      const name = branch?.name;
      const repository = branch?.repository;
      const upstreamBranch = branch?.upstreamBranch;
      const expected = typeof expectedRepository === "string" && typeof expectedBranch === "string"
        ? `${expectedRepository}#${expectedBranch}`
        : localize(language, "the configured primary", "配置的 primary");
      const branchName = codeSpan(typeof name === "string" ? name : localize(language, "unknown", "未知"));
      if (typeof repository === "string" && typeof upstreamBranch === "string") {
        const actual = codeSpan(`${repository}#${upstreamBranch}`);
        return proseFacts([
          localize(
            language,
            `Local branch ${branchName} tracks ${actual}, but it must track ${codeSpan(expected)}.`,
            `本地分支 ${branchName} 当前跟踪 ${actual}，但应跟踪 ${codeSpan(expected)}。`,
          ),
        ]);
      }
      return proseFacts([
        localize(
          language,
          `Local branch ${branchName} has no configured upstream, but it must track ${codeSpan(expected)}.`,
          `本地分支 ${branchName} 尚未配置 upstream，但应跟踪 ${codeSpan(expected)}。`,
        ),
      ]);
    }

    const relation = types.find((type) =>
      type === "primary-ahead" || type === "primary-behind" || type === "primary-diverged"
    );
    if (relation !== undefined) {
      const relationText = relation === "primary-ahead"
        ? localize(language, "ahead of", "领先于")
        : relation === "primary-behind"
        ? localize(language, "behind", "落后于")
        : localize(language, "diverged from", "已偏离");
      return proseFacts([
        localize(
          language,
          `The current branch is ${relationText} the configured primary, so its history must be reconciled before Idea work continues.`,
          `当前分支${relationText}配置的 primary，因此继续 Idea 工作前需要先协调 history。`,
        ),
      ]);
    }
  }

  if (
    problem.id === "ideal-unsubmitted"
    || problem.id === "ideal-unaccepted"
    || problem.id === "implementation-unsubmitted"
    || problem.id === "implementation-unaccepted"
    || problem.id === "deployment-unsubmitted"
    || problem.id === "deployment-unaccepted"
  ) {
    const revision = problem.parameters.revision;
    const requirement = problem.parameters.requirement;
    const phase = problem.id.startsWith("ideal-")
      ? localize(language, "Idea definition", "Idea 定义")
      : problem.id.startsWith("implementation-")
      ? localize(language, "implementation", "实现")
      : localize(language, "deployment", "部署");
    if (typeof revision === "string" && typeof requirement === "string") {
      return proseFacts([
        localize(
          language,
          `The current ${phase} revision ${codeSpan(revision.slice(0, 12))} has not reached the required ${codeSpan(requirement)} state, so Idea progress cannot advance.`,
          `当前${phase} revision ${codeSpan(revision.slice(0, 12))} 尚未达到要求的 ${codeSpan(requirement)} 状态，因此 Idea 无法继续推进。`,
        ),
      ]);
    }
  }

  if (
    problem.id === "project-guidance"
    || problem.id === "project-primary-guidance"
  ) {
    const diagnostics = problem.parameters.diagnostics;
    const paths = Array.isArray(diagnostics)
      ? diagnostics.flatMap((entry) =>
        entry !== null && typeof entry === "object" && "path" in entry
          && typeof entry.path === "string"
          ? [entry.path]
          : []
      )
      : [];
    if (paths.length > 0) {
      return proseFacts([
        localize(
          language,
          `Phase guidance has contract diagnostics at ${paths.map(codeSpan).join(", ")}.`,
          `阶段 guidance 在 ${paths.map(codeSpan).join("、")} 存在 contract 诊断。`,
        ),
      ]);
    }
  }

  return [];
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
  if (idea.gateModes !== undefined) {
    lines.push(
      `- ${localize(language, "Gate modes", "门禁模式")}: `
      + `ideal=${codeSpan(idea.gateModes.ideal)}, `
      + `inner=${codeSpan(idea.gateModes.inner)}, `
      + `outer=${codeSpan(idea.gateModes.outer)}`,
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
    || (device.skill.observed?.some(({ revision }) =>
      revision !== device.skill.expectedRevision
    ) ?? false);
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
  const skillDetails = device.skill.status === "incorrect"
    ? [
        `expected=${device.skill.expectedRevision ?? "unverifiable"}`,
        ...(device.skill.observed ?? []).map(({ path, revision }) =>
          `${path}=${revision ?? "unreadable"}`
        ),
      ].join("; ")
    : device.skill.summary
    ?? (device.skill.observed?.length
      ? device.skill.observed.map(({ path, revision }) =>
        `${path}=${revision ?? "unreadable"}`
      ).join(", ")
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
  const primary = response.details?.primary;
  if (root !== undefined || primary !== undefined) {
    const context = [
      ...(root === undefined
        ? []
        : [`${localize(language, "root", "根目录")} ${codeSpan(root)}`]),
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
    const renderedProblems = objective.problems.map((problem) => {
      const reference = objective.references.find(
        ({ id, kind }) => kind === "problem" && id === `problems/${problem.id}`,
      );
      const facts = problemFacts(problem, language).map((line) =>
        line.replace(/^   /, "")
      );
      const usesDirectFacts = problem.id === "device-skill"
        || problem.id === "device-canonical-skill"
        || problem.id === "project"
        || problem.id === "repository"
        || problem.id.startsWith("device-configuration-");
      const description = usesDirectFacts && facts.length > 0
        ? undefined
        : reference?.description ?? reference?.title ?? codeSpan(problem.id);
      return [...(description === undefined ? [] : [description]), ...facts];
    });
    const uniqueProblems: string[][] = [];
    for (const content of renderedProblems) {
      if (!uniqueProblems.some((candidate) =>
        candidate.join("\n") === content.join("\n")
      )) {
        uniqueProblems.push(content);
      }
    }
    for (const [index, content] of uniqueProblems.entries()) {
      if (uniqueProblems.length === 1) {
        lines.push(...content);
      } else {
        const [first = "", ...rest] = content;
        lines.push(`${index + 1}. ${first}`, ...rest.map((line) => `   ${line}`));
      }
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
  for (const [index, reference] of objective.references.entries()) {
    if (objective.references.findIndex(({ kind, id }) =>
      kind === reference.kind && id === reference.id
    ) !== index) {
      continue;
    }
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
