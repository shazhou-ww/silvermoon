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
import {
  inspectProjectSchemas,
  type ProjectSchemaReadiness,
  type SchemaFileReadiness,
} from "../../foundation/schema-capability/index.ts";

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

interface SnapshotDeviceObservation {
  readiness?: DeviceAdvisory;
  user: {
    config: { preferredLanguage?: string } | null;
    diagnostics: Diagnostic[];
  };
}

type SnapshotDeviceObserver = (options: {
  entryPath?: string;
  forceRuntimeRefresh: boolean;
  includeReadiness: boolean;
  userHome?: string;
}) => Promise<SnapshotDeviceObservation>;

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
    : device.skill.status === "source-checkout"
      ? `把当前 checkout 链接为设备级全局 Silvermoon runtime，在个人级 skill discovery 路径中以链接注册 ${device.skill.expectedRoot}，然后用 silvermoon 重试。`
      : device.skill.status === "missing"
      ? `运行 silvermoon-link-skill，把当前全局 runtime 的 canonical skill ${device.skill.expectedRoot} 链接到个人级 discovery 路径，然后重试当前 Silvermoon 命令。`
      : device.skill.status === "mismatched"
        ? `运行 silvermoon-link-skill，把报告的个人级 skill registration 重新链接到当前全局 runtime 的 canonical skill ${device.skill.expectedRoot}，然后重试当前 Silvermoon 命令。`
        : `修复 Silvermoon 安装，确保 ${device.skill.expectedRoot} 包含可读的 SKILL.md。`;
  const skillSummary = device.skill.status === "mismatched"
    ? device.skill.invalidTargets?.map(({ path, target }) =>
      `个人级 skill registration ${path} 当前解析到 ${target ?? "不可读目标"}；当前全局 runtime 期望 ${device.skill.expectedRoot}。`
    ).join(" ")
    : device.skill.summary === undefined
      ? undefined
      : `无法完整检查个人级 Silvermoon skill：${device.skill.summary}`;
  const updateSummary = device.update.status === "available"
    ? `将全局 Silvermoon runtime 升级到 ${device.update.latestVersion}。`
    : device.update.status === "source-checkout"
      ? "本次命令绕过了设备级全局 Silvermoon 链接；请把当前 checkout 链接到全局，并用 silvermoon 重试后再检查 npm latest。"
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
      ...(skillSummary === undefined ? {} : { summary: skillSummary }),
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

function futureSchemaDiagnostic(
  file: SchemaFileReadiness,
  device: DeviceAdvisory | undefined,
): Diagnostic {
  const update = device?.update;
  if (update?.status === "available") {
    return {
      code: "schema.runtime-update-available",
      level: "error",
      path: file.path,
      message: `Schema version ${String(file.schemaVersion)} is newer than this runtime can read; Silvermoon ${update.latestVersion ?? "latest"} is available.`,
      remediation: `Upgrade the global Silvermoon runtime, then prepare ${file.path} again.`,
    };
  }
  if (update?.status === "current") {
    return {
      code: "schema.runtime-latest-unsupported",
      level: "error",
      path: file.path,
      message: `Schema version ${String(file.schemaVersion)} is newer than the confirmed latest Silvermoon runtime can read.`,
      remediation: "Do not modify this project with the current runtime; obtain a runtime that declares this schema capability.",
    };
  }
  if (update?.status === "unavailable") {
    return {
      code: "schema.runtime-freshness-unavailable",
      level: "error",
      path: file.path,
      message: `Schema version ${String(file.schemaVersion)} is newer than this runtime can read, and npm latest could not be confirmed.`,
      remediation: "Restore registry access, confirm the latest global Silvermoon runtime, and retry without modifying project metadata.",
    };
  }
  return {
    code: "schema.runtime-upgrade-required",
    level: "error",
    path: file.path,
    message: `Schema version ${String(file.schemaVersion)} is newer than this runtime can read.`,
    remediation: update?.status === "source-checkout"
      ? "Update this Silvermoon checkout to a revision that declares the required schema capability, link it globally, and rerun with silvermoon."
      : update?.status === "managed-by-host"
        ? "Update the host-provided Silvermoon runtime before modifying this project."
        : "Upgrade the Silvermoon runtime before modifying this project.",
  };
}

function projectSchemaDiagnostics({
  device,
  projectOnly,
  requireCurrentSchemas,
  schemas,
}: {
  device: DeviceAdvisory | undefined;
  projectOnly: boolean;
  requireCurrentSchemas: boolean;
  schemas: ProjectSchemaReadiness | undefined;
}): Diagnostic[] {
  if (schemas === undefined) return [];
  const diagnostics: Diagnostic[] = [];
  const migrationGroups = new Map<string, {
    files: SchemaFileReadiness[];
    path: NonNullable<SchemaFileReadiness["migrationPath"]>;
  }>();
  for (const file of schemas.files) {
    if (file.validity === "invalid") {
      diagnostics.push({
        code: "schema.invalid",
        level: "error",
        path: file.path,
        message: file.message
          ?? `The ${file.family} schema declaration is invalid.`,
        remediation: `Repair ${file.path} to satisfy ${file.family} schema version ${String(file.schemaVersion ?? "unknown")}.`,
      });
      continue;
    }
    if (file.validity === "unsupported") {
      diagnostics.push(futureSchemaDiagnostic(file, device));
      continue;
    }
    if (
      projectOnly
      || !requireCurrentSchemas
      || file.readiness === "current"
    ) continue;
    if (file.readiness === "migration-required") {
      const migrationPath = file.migrationPath;
      if (migrationPath === undefined || migrationPath.length === 0) {
        diagnostics.push({
          code: "schema.migration-required",
          level: "error",
          path: file.path,
          message: `${file.family} schema version ${String(file.schemaVersion)} is valid but the current write target is version ${file.targetVersion}.`,
          remediation: `Migrate ${file.path} before continuing.`,
        });
        continue;
      }
      const key = migrationPath.map(({ id }) => id).join("\0");
      const group = migrationGroups.get(key);
      if (group === undefined) {
        migrationGroups.set(key, { files: [file], path: migrationPath });
      } else {
        group.files.push(file);
      }
    } else if (file.readiness === "migration-unavailable") {
      diagnostics.push({
        code: "schema.migration-unavailable",
        level: "error",
        path: file.path,
        message: file.message
          ?? `No migration reaches ${file.family} schema version ${file.targetVersion}.`,
        remediation: "Use a Silvermoon runtime that provides a migration path; do not modify the file manually.",
      });
    }
  }
  const migrationDiagnostics = [...migrationGroups.values()].map(
    ({ files, path }): Diagnostic => {
      const migration = path[0];
      if (migration === undefined) {
        throw new Error("Schema migration group is missing its first edge.");
      }
      const command = [
        migration.executable,
        ...migration.arguments,
      ].join(" ");
      const migrationIds = path.map(({ id }) => id).join(" -> ");
      return {
        code: "schema.migration-required",
        level: "error",
        message: `${files.length} valid historical schema file${files.length === 1 ? "" : "s"} require the project migration path ${migrationIds} before Silvermoon can write this project.`,
        remediation: device?.runtime.source === "host"
          ? `Run the host-managed ${migrationIds} project migration before continuing.`
          : device?.runtime.source === "source-checkout"
            ? `Link this checkout globally, then run ${command} to generate the read-only project migration plan before continuing.`
            : `Run ${command} to generate the read-only project migration plan before continuing.`,
      };
    },
  );
  return [...migrationDiagnostics, ...diagnostics];
}

function schemaOwnsConfigDiagnostic(
  _diagnostic: Diagnostic,
  schemas: ProjectSchemaReadiness | undefined,
) {
  return schemas?.files.some(({ family, validity }) =>
    family === "project-config" && validity !== "valid"
  ) === true;
}

function schemaOwnsLayoutDiagnostic(
  diagnostic: Diagnostic,
  schemas: ProjectSchemaReadiness | undefined,
  projectOnly: boolean,
) {
  if (schemas === undefined || diagnostic.path === undefined) return false;
  if (
    diagnostic.code === "idea.events.format-invalid"
    && schemas.files.some(({ family, path, readiness }) =>
      family === "idea-state"
      && path.endsWith("/status.yaml")
      && readiness !== "current"
    )
  ) {
    return true;
  }
  const path = diagnostic.path.split("#", 1)[0] ?? diagnostic.path;
  for (const file of schemas.files) {
    if (file.family !== "idea-state") continue;
    const ideaRoot = file.path.slice(0, file.path.lastIndexOf("/"));
    if (!path.startsWith(`${ideaRoot}/`)) continue;
    if (
      file.validity !== "valid"
      && (
        diagnostic.code === "idea.status.invalid"
        || diagnostic.code === "idea.status.invalid-file"
        || diagnostic.code === "idea.status.unexpected-file"
      )
    ) {
      return true;
    }
    if (
      !projectOnly
      && file.readiness === "migration-required"
      && (
        diagnostic.code === "idea.status.invalid-file"
        || diagnostic.code === "idea.status.unexpected-file"
      )
    ) {
      return true;
    }
  }
  return false;
}

async function observeSnapshotInternal({
  allowMissingIdeas = false,
  contentRoot,
  entryPath,
  filesystem,
  gitRoot,
  ideaLanguage,
  deviceObserver = observeDevice,
  outputLanguage: requestedOutputLanguage,
  projectOnly = false,
  requireCurrentSchemas = true,
  root,
  snapshotTree,
  userHome,
  version,
}: {
  allowMissingIdeas?: boolean;
  contentRoot?: string | undefined;
  entryPath?: string | undefined;
  filesystem?: BusinessFileSystem | undefined;
  gitRoot?: string | undefined;
  ideaLanguage?: string | undefined;
  deviceObserver?: SnapshotDeviceObserver;
  outputLanguage?: string | undefined;
  projectOnly?: boolean;
  requireCurrentSchemas?: boolean;
  root: string;
  snapshotTree?: string | undefined;
  userHome?: string | undefined;
  version?: ProjectVersion | undefined;
}): Promise<SnapshotObservation> {
  const outputLanguageOverride = requestedOutputLanguage === undefined
    ? undefined
    : resolveOutputLanguage({ override: requestedOutputLanguage }).tag;
  const adoption = await traceBusinessAsync(
    "project.observe",
    {},
    () => observeProject({
      contentRoot,
      filesystem,
      gitRoot,
      root,
    }),
  );
  let schemas: ProjectSchemaReadiness | undefined;
  let schemaInspectionDiagnostic: Diagnostic | undefined;
  try {
    schemas = await traceBusinessAsync(
      "schema.inspect",
      {},
      () => inspectProjectSchemas({
        ...(filesystem === undefined ? {} : { filesystem }),
        root: contentRoot ?? adoption.root,
      }),
    );
  } catch (caught) {
    schemaInspectionDiagnostic = {
      code: "schema.inspection-failed",
      level: "error",
      path: ".silvermoon",
      message: `Cannot inspect project schemas: ${errorMessage(caught)}`,
      remediation: "Repair the Silvermoon runtime schema manifest and retry.",
    };
  }
  const futureSchema = schemas?.files.some(
    ({ readiness }) => readiness === "runtime-upgrade-required",
  ) === true;
  const device = await traceBusinessAsync(
    "device.observe",
    {},
    () => deviceObserver({
      ...(entryPath === undefined ? {} : { entryPath }),
      forceRuntimeRefresh: !projectOnly && futureSchema,
      includeReadiness: !projectOnly,
      ...(userHome === undefined ? {} : { userHome }),
    }),
  );
  const rawDeviceAdvisory = device.readiness;
  const user = device.user;
  const userFindings: Finding[] = user.diagnostics.map((diagnostic: Diagnostic) => ({
    priority: 30,
    problem: diagnosticProblem(diagnostic),
    instruction: diagnostic.remediation,
    sourceDiagnostic: diagnostic,
  }));
  const rawSchemaDiagnostics = [
    ...(schemaInspectionDiagnostic === undefined
      ? []
      : [schemaInspectionDiagnostic]),
    ...projectSchemaDiagnostics({
      device: rawDeviceAdvisory,
      projectOnly,
      requireCurrentSchemas,
      schemas,
    }),
  ];
  const schemaFindings: Finding[] = rawSchemaDiagnostics.map((diagnostic) => ({
    priority: 25,
    problem: diagnosticProblem(diagnostic),
    instruction: diagnostic.remediation,
    sourceDiagnostic: diagnostic,
  }));
  const adoptionFindings = adoption.findings.filter(
    ({ sourceDiagnostic }: { sourceDiagnostic?: Diagnostic }) =>
      sourceDiagnostic === undefined
      || !schemaOwnsConfigDiagnostic(sourceDiagnostic, schemas),
  );
  const baseFindings = [
    ...adoptionFindings,
    ...schemaFindings,
    ...userFindings,
  ]
    .map(requireFinding)
    .sort((left, right) => left.priority - right.priority);
  const fallbackContentLanguage = resolveLanguage({
    ...(user.config?.preferredLanguage === undefined
      ? {}
      : { global: user.config.preferredLanguage }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
  layout.diagnostics = layout.diagnostics.filter(
    (diagnostic) => !schemaOwnsLayoutDiagnostic(
      diagnostic,
      schemas,
      projectOnly,
    ),
  );

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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
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
      ...(schemas === undefined ? {} : { schemas }),
    },
    outputLanguage,
    ...(outputLanguageOverride === undefined ? {} : { outputLanguageOverride }),
    projectReady: true,
    ...(schemas === undefined ? {} : { schemas }),
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
