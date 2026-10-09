import { diagnosticInstruction, diagnosticProblem, resolvedConfiguration, summarizeIdeas } from "../../foundation/report/index.ts";
import { localize } from "../../foundation/language/index.ts";
import { inspectAllGuidance } from "../../foundation/guidance/index.ts";
import { observeDevice } from "./observe-device.ts";
import { observeIdea } from "./observe-idea.ts";
import { observeProject } from "./observe-project.ts";
import { resolveLanguage, resolveOutputLanguage } from "../../foundation/language/index.ts";
import { projectObservation } from "../../foundation/report/index.ts";
import type {
  BusinessFileSystem,
  Diagnostic,
  Problem,
  SnapshotObservation,
} from "./business-types.ts";
import { errorMessage, traceBusinessAsync } from "./business-types.ts";
import type { IdeaLayout } from "./idea-layout.ts";
import type { ProjectVersion } from "../../foundation/report/types.ts";
import type { DeviceAdvisory } from "../../foundation/report/types.ts";

interface Finding {
  priority: number;
  problem: Problem;
  instruction: string;
  sourceDiagnostic?: Diagnostic;
}

interface SnapshotFilesystem extends BusinessFileSystem {
  snapshotEntry(path: string): import("./business-types.ts").SnapshotEntry | null | undefined;
  snapshotEntries(path: string): import("./business-types.ts").SnapshotEntry[];
  snapshotFile(path: string): Promise<Buffer>;
}

function requireFinding(value: {
  priority: number;
  problem: Problem | undefined;
  instruction: string;
  sourceDiagnostic?: Diagnostic;
}): Finding {
  if (value.problem === undefined) {
    throw new TypeError("Project inspection returned a finding without a problem.");
  }
  return {
    priority: value.priority,
    problem: value.problem,
    instruction: value.instruction,
    ...(value.sourceDiagnostic === undefined
      ? {}
      : { sourceDiagnostic: value.sourceDiagnostic }),
  };
}

function requireSnapshotFilesystem(
  filesystem: BusinessFileSystem | undefined,
): SnapshotFilesystem | undefined {
  if (filesystem === undefined) return undefined;
  if (
    typeof filesystem.snapshotEntry !== "function"
    || typeof filesystem.snapshotEntries !== "function"
    || typeof filesystem.snapshotFile !== "function"
  ) {
    throw new TypeError("Snapshot inspection requires snapshot filesystem capabilities.");
  }
  return {
    ...filesystem,
    snapshotEntry: filesystem.snapshotEntry,
    snapshotEntries: filesystem.snapshotEntries,
    snapshotFile: filesystem.snapshotFile,
  };
}

function diagnosticsFrom(value: unknown): Diagnostic[] {
  if (!value || typeof value !== "object" || !("diagnostics" in value)
    || !Array.isArray(value.diagnostics)) {
    throw new TypeError("Guidance inspection returned an invalid diagnostic result.");
  }
  return value.diagnostics.map((diagnostic: unknown) => {
    if (!diagnostic || typeof diagnostic !== "object"
      || !("code" in diagnostic) || typeof diagnostic.code !== "string"
      || !("level" in diagnostic) || typeof diagnostic.level !== "string"
      || !("message" in diagnostic) || typeof diagnostic.message !== "string"
      || !("remediation" in diagnostic) || typeof diagnostic.remediation !== "string") {
      throw new TypeError("Guidance inspection returned an invalid diagnostic.");
    }
    return {
      code: diagnostic.code,
      level: diagnostic.level,
      message: diagnostic.message,
      remediation: diagnostic.remediation,
      ...("path" in diagnostic && typeof diagnostic.path === "string"
        ? { path: diagnostic.path }
        : {}),
    };
  });
}

function localizeFinding(finding: Finding, language: string): Finding {
  if (finding.sourceDiagnostic) {
    return {
      priority: finding.priority,
      problem: diagnosticProblem(finding.sourceDiagnostic, language),
      instruction: diagnosticInstruction(finding.sourceDiagnostic, language),
    };
  }
  return {
    priority: finding.priority,
    problem: {
      type: finding.problem.type,
      summary: localize(
        language,
        finding.problem.summary,
        `Silvermoon 发现 ${finding.problem.type}：${finding.problem.summary}`,
      ),
    },
    instruction: localize(
      language,
      finding.instruction,
      `处理 ${finding.problem.type}：${finding.instruction}`,
    ),
  };
}

function localizeDeviceAdvisory(
  device: DeviceAdvisory | undefined,
  language: string,
) {
  if (device === undefined || !language.toLowerCase().startsWith("zh")) {
    return device;
  }
  const skillRemediation = device.skill.remediation === undefined
    ? undefined
    : device.skill.status === "missing"
      ? `在个人级 skill discovery 路径中，将 ${device.skill.expectedRoot} 注册为链接。`
      : device.skill.status === "mismatched"
        ? `把报告的个人级 skill 注册替换为指向 ${device.skill.expectedRoot} 的链接。`
        : `修复 Silvermoon 安装，确保 ${device.skill.expectedRoot} 包含可读的 SKILL.md。`;
  const updateSummary = device.update.status === "available"
    ? `将全局 Silvermoon runtime 升级到 ${device.update.latestVersion}。`
    : device.update.status === "source-checkout"
      ? "当前使用源码 checkout 开发 runtime；npm latest 状态只适用于全局安装。"
      : device.update.status === "managed-by-host"
        ? "Silvermoon runtime 更新由嵌入它的 host 管理。"
        : device.update.summary === undefined
          ? undefined
          : device.update.status === "unavailable"
            ? `无法确认最新 Silvermoon runtime：${device.update.summary}`
            : `Silvermoon runtime freshness cache 提示：${device.update.summary}`;
  return {
    runtime: {
      ...device.runtime,
      ...(device.runtime.summary === undefined
        ? {}
        : { summary: `无法完整检查 Silvermoon runtime：${device.runtime.summary}` }),
    },
    skill: {
      ...device.skill,
      ...(device.skill.summary === undefined
        ? {}
        : { summary: `无法完整检查个人级 Silvermoon skill：${device.skill.summary}` }),
      ...(skillRemediation === undefined
        ? {}
        : { remediation: skillRemediation }),
    },
    update: {
      ...device.update,
      ...(updateSummary === undefined ? {} : { summary: updateSummary }),
    },
  };
}

async function observeSnapshotInternal({
  allowMissingIdeas = false,
  contentRoot,
  filesystem,
  gitRoot,
  ideaLanguage,
  outputLanguage: requestedOutputLanguage,
  projectOnly = false,
  root,
  snapshotTree,
  userHome,
  version,
}: {
  allowMissingIdeas?: boolean;
  contentRoot?: string | undefined;
  filesystem?: BusinessFileSystem | undefined;
  gitRoot?: string | undefined;
  ideaLanguage?: string | undefined;
  outputLanguage?: string | undefined;
  projectOnly?: boolean;
  root: string;
  snapshotTree?: string | undefined;
  userHome?: string | undefined;
  version?: ProjectVersion | undefined;
}): Promise<SnapshotObservation> {
  const outputLanguageOverride = requestedOutputLanguage === undefined
    ? undefined
    : resolveOutputLanguage({ override: requestedOutputLanguage }).tag;
  const device = await traceBusinessAsync(
    "device.observe",
    {},
    () => observeDevice({ includeReadiness: !projectOnly, userHome }),
  );
  const rawDeviceAdvisory = device.readiness;
  const adoption = await traceBusinessAsync(
    "project.observe",
    {},
    () => observeProject({
      contentRoot,
      device,
      filesystem,
      gitRoot,
      root,
    }),
  );
  const user = device.user;
  const userFindings: Finding[] = user.diagnostics.map((diagnostic: Diagnostic) => ({
    priority: 30,
    problem: diagnosticProblem(diagnostic),
    instruction: diagnostic.remediation,
    sourceDiagnostic: diagnostic,
  }));
  const baseFindings = [...adoption.findings, ...userFindings]
    .map(requireFinding)
    .sort((left, right) => left.priority - right.priority);
  const fallbackContentLanguage = resolveLanguage({
    global: user.config?.preferredLanguage,
  }).tag;
  const fallbackOutputLanguage = resolveOutputLanguage({
    content: fallbackContentLanguage,
    ...(outputLanguageOverride === undefined ? {} : { override: outputLanguageOverride }),
  }).tag;
  const fallbackDeviceAdvisory = localizeDeviceAdvisory(
    rawDeviceAdvisory,
    fallbackOutputLanguage,
  );

  if (!adoption.gitReady) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackOutputLanguage)
    );
    const observation = projectObservation({
      ...(fallbackDeviceAdvisory === undefined
        ? {}
        : { device: fallbackDeviceAdvisory }),
      outputLanguage: fallbackOutputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
    });
    return {
      config: null,
      contentLanguage: fallbackContentLanguage,
      findings,
      layout: null,
      observation,
      outputLanguage: fallbackOutputLanguage,
      ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
      projectReady: false,
    };
  }

  if (!adoption.config) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackOutputLanguage)
    );
    const observation = projectObservation({
      ...(fallbackDeviceAdvisory === undefined
        ? {}
        : { device: fallbackDeviceAdvisory }),
      outputLanguage: fallbackOutputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      ...(version === undefined ? {} : { version }),
    });
    return {
      config: null,
      contentLanguage: fallbackContentLanguage,
      findings,
      layout: null,
      observation,
      outputLanguage: fallbackOutputLanguage,
      ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
      projectReady: false,
    };
  }

  const contentLanguage = resolveLanguage({
    ...(ideaLanguage === undefined ? {} : { idea: ideaLanguage }),
    ...(adoption.config.preferredLanguage === undefined
      ? {}
      : { project: adoption.config.preferredLanguage }),
    ...(user.config?.preferredLanguage === undefined
      ? {}
      : { global: user.config.preferredLanguage }),
  }).tag;
  const outputLanguage = resolveOutputLanguage({
    content: contentLanguage,
    ...(outputLanguageOverride === undefined ? {} : { override: outputLanguageOverride }),
  }).tag;
  const config = adoption.config;
  const configuration = resolvedConfiguration(config, contentLanguage);
  const deviceAdvisory = localizeDeviceAdvisory(
    rawDeviceAdvisory,
    outputLanguage,
  );
  const findings = baseFindings.map((finding) =>
    localizeFinding(finding, outputLanguage)
  );
  let layout: IdeaLayout;
  try {
    layout = await traceBusinessAsync(
      "idea-layout.inspect",
      {},
      () => observeIdea({
        config,
        ...(filesystem === undefined ? {} : { filesystem }),
        gitRoot: gitRoot ?? adoption.root,
        project: adoption,
        root: contentRoot ?? adoption.root,
        ...(snapshotTree === undefined ? {} : { snapshotTree }),
      }),
    );
  } catch (caught) {
    layout = {
      diagnostics: [{
        code: "layout.inspection-failed",
        level: "error",
        path: ".silvermoon/ideas",
        message: `Cannot inspect Silvermoon ideas: ${errorMessage(caught)}`,
        remediation: "Repair the ideas directory and retry.",
      }],
      ideas: [],
    };
  }
  if (allowMissingIdeas) {
    layout.diagnostics = layout.diagnostics.filter(
      ({ code }: Diagnostic) => code !== "layout.ideas.missing",
    );
  }

  const guidanceDiagnostics = projectOnly
    ? diagnosticsFrom(await inspectAllGuidance({
      ...(filesystem === undefined
        ? {}
        : { filesystem: requireSnapshotFilesystem(filesystem) }),
      gitRoot: gitRoot ?? adoption.root,
      snapshotTree: snapshotTree
        ?? (() => {
          throw new TypeError("Project-only inspection requires a snapshot tree.");
        })(),
    }))
    : [];
  const layoutFindings: Finding[] = layout.diagnostics.map((diagnostic: Diagnostic) => ({
    priority: 50,
    problem: diagnosticProblem(diagnostic, outputLanguage),
    instruction: diagnosticInstruction(diagnostic, outputLanguage),
  }));
  const guidanceFindings: Finding[] = guidanceDiagnostics.map((diagnostic: Diagnostic) => ({
    priority: 60,
    problem: diagnosticProblem(diagnostic, outputLanguage),
    instruction: diagnosticInstruction(diagnostic, outputLanguage),
  }));
  findings.push(...layoutFindings, ...guidanceFindings);
  findings.sort((left, right) => left.priority - right.priority);

  if (layout.diagnostics.length > 0) {
    const observation = projectObservation({
      configuration,
      ...(deviceAdvisory === undefined ? {} : { device: deviceAdvisory }),
      outputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      ...(version === undefined ? {} : { version }),
    });
    return {
      config,
      contentLanguage,
      findings,
      layout,
      observation,
      outputLanguage,
      ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
      projectReady: false,
    };
  }

  const ideas = summarizeIdeas(layout.ideas);
  if (findings.length > 0) {
    const observation = projectObservation({
      configuration,
      ...(deviceAdvisory === undefined ? {} : { device: deviceAdvisory }),
      ideas,
      outputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      ...(version === undefined ? {} : { version }),
    });
    return {
      config,
      contentLanguage,
      findings,
      layout,
      observation,
      outputLanguage,
      ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
      projectReady: false,
    };
  }

  return {
    config,
    contentLanguage,
    findings,
    layout,
    observation: {
      state: "project-ready",
      root: adoption.root,
      version: version ?? { type: "worktree" },
      configuration,
      ...(deviceAdvisory === undefined ? {} : { device: deviceAdvisory }),
      ideas,
      outputLanguage,
      problems: [],
    },
    outputLanguage,
    ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
    projectReady: true,
  };
}

export async function observeSnapshot(
  options: Parameters<typeof observeSnapshotInternal>[0],
): Promise<SnapshotObservation> {
  return traceBusinessAsync(
    "snapshot.observe",
    {},
    () => observeSnapshotInternal(options),
  );
}
