import { createObjectiveLoader, ObjectiveOperationError } from "../objective-guide/index.ts";
import type {
  CheckResult, ObjectiveGuideManifest, ObjectiveLevelsManifest, ObjectiveLoader,
  ObjectiveResourceResolver, ObjectiveGuideInstance, ObjectiveSubject,
} from "../objective-guide/index.ts";

export const SILVERMOON_OBJECTIVE_URIS = Object.freeze({
  device: "silvermoon://objectives/device/manifest.yaml",
  project: "silvermoon://objectives/project/manifest.yaml",
  idea: "silvermoon://objectives/idea/manifest.yaml",
});
export const SILVERMOON_OBJECTIVE_LEVELS = Object.freeze({
  device: [
    ["configuration-invalid", ["device-config-valid"], "Valid personal configuration", "个人配置合法"],
    ["runtime-unready", ["device-runtime-linked"], "Recognized device runtime", "设备运行时可识别"],
    ["skill-unready", ["device-skill-discoverable"], "Discoverable canonical skill", "canonical skill 可发现"],
    ["update-unconfirmed", ["device-update-current"], "Confirmed runtime update status", "运行时更新状态已确认"],
  ],
  project: [
    ["configuration-invalid", ["project-config-valid", "project-user-config-valid", "project-layout-valid"], "Valid project configuration", "项目配置合法"],
    ["project-unprepared", ["project-adopted", "project-schema-ready", "project-guidance-valid"], "Prepared project", "项目已整备"],
    ["repository-unready", ["repository-worktree-clean", "repository-head-present", "repository-upstream-matches"], "Safe local repository", "本地仓库可安全同步"],
    ["primary-unconfirmed", ["repository-primary-fetched", "repository-primary-aligned", "repository-event-history-valid", "project-primary-guidance-valid"], "Confirmed primary snapshot", "primary snapshot 已确认"],
  ],
  idea: [
    ["configuration-invalid", ["idea-metadata-valid", "idea-contracts-valid"], "Valid selected Idea", "所选 Idea 配置合法"],
    ["ideal-unsubmitted", ["idea-ideal-submitted"], "Submit exact Ideal revision", "提交准确 Ideal revision"],
    ["ideal-unaccepted", ["idea-ideal-accepted"], "Accept exact Ideal revision", "接受准确 Ideal revision"],
    ["implementation-unsubmitted", ["idea-inner-submitted"], "Submit exact Inner revision", "提交准确 Inner revision"],
    ["implementation-unaccepted", ["idea-inner-accepted"], "Accept exact Inner revision", "接受准确 Inner revision"],
    ["deployment-unsubmitted", ["idea-outer-submitted"], "Submit exact Outer revision", "提交准确 Outer revision"],
    ["deployment-unaccepted", ["idea-outer-accepted"], "Accept exact Outer revision", "接受准确 Outer revision"],
  ],
} as const);
export type SilvermoonCheckId = (typeof SILVERMOON_OBJECTIVE_LEVELS)[keyof typeof SILVERMOON_OBJECTIVE_LEVELS][number][1][number];
export type SilvermoonObjectiveCheck = (subject: ObjectiveSubject) => Promise<CheckResult>;
export type SilvermoonObjectiveChecks = Readonly<Record<SilvermoonCheckId, SilvermoonObjectiveCheck>>;
export function probeObjective(instance: ObjectiveGuideInstance) {
  return instance.probe();
}
export const SILVERMOON_PROBLEM_IDS = Object.freeze([
  "project", "repository", "guidance", "ideal", "inner", "outer",
  "idea-configuration", "idea-inactive", "device-configuration", "device-runtime",
  "device-skill", "device-update",
] as const);

const REFERENCE_TEXT = {
  project: [
    "Repair the reported project configuration, schema or layout first. Preserve unknown work. Reobserve with the exact original command and selector.",
    "先修复报告中的项目配置、schema 或目录问题，保留未知工作，再用准确原命令和 selector 重新观测。",
  ],
  repository: [
    "Preserve unknown work, validate the exact candidate, then synchronize by ordinary non-force Git against the reported primary.",
    "保留未知工作，验证准确候选后按报告的 primary 使用普通非强制 Git 同步。",
  ],
  guidance: [
    "Project owns all phase guidance. Missing files are allowed; invalid files block project readiness.",
    "Project 持有全部阶段 guidance；缺失正常，存在但非法则阻塞项目整备。",
  ],
  ideal: [
    "Prepare, synchronize and submit the exact Ideal revision; accept it only after an explicit human decision.",
    "整备、同步并提交准确 Ideal revision；仅在明确人工决定后接受。",
  ],
  inner: [
    "Implement within the accepted Ideal, synchronize evidence and submit the exact Inner revision.",
    "在已接受 Ideal 内实现，同步证据并提交准确 Inner revision。",
  ],
  outer: [
    "Verify real deployment outcomes, synchronize evidence and submit the exact Outer revision.",
    "验证现实部署结果，同步证据并提交准确 Outer revision。",
  ],
  "idea-configuration": [
    "Repair the selected Idea metadata, language, world entries and ledger structure.",
    "修复所选 Idea 的 metadata、语言、world 入口与 ledger 结构。",
  ],
  "idea-inactive": [
    "An abandoned Idea is stopped, not completed. Resume only after an explicit reversal.",
    "abandoned Idea 已停止而非完成，仅在明确反转后 resume。",
  ],
  "device-configuration": ["Repair the personal configuration.", "修复个人配置。"],
  "device-runtime": ["Use the expected linked Silvermoon runtime.", "使用预期的已链接 Silvermoon runtime。"],
  "device-skill": ["Make the canonical personal skill discoverable.", "让 canonical personal skill 可发现。"],
  "device-update": ["Resolve or acknowledge the reported runtime update state.", "处理或确认报告的 runtime 更新状态。"],
} as const;

function markdown(properties: Record<string, string>, body = "") {
  const frontmatter = Object.entries(properties).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n");
  return `---\n${frontmatter}\n---\n${body}\n`;
}

export function createSilvermoonObjectiveLoader(checks: SilvermoonObjectiveChecks): ObjectiveLoader {
  const texts = new Map<string, string>();
  const pages = new Map<string, { uri: string; source: string }[]>();
  for (const scope of ["device", "project", "idea"] as const) {
    const uri = SILVERMOON_OBJECTIVE_URIS[scope];
    const definitions = SILVERMOON_OBJECTIVE_LEVELS[scope];
    const levels = definitions.map(([id, names]) => ({ id, advancement: { checks: [...names] } }));
    const required = scope === "device" ? ["userHome"] : scope === "project" ? ["root", "userHome"] : ["root", "userHome", "ideaId"];
    const manifest: ObjectiveGuideManifest = {
      schemaVersion: 1,
      domainSchema: {
        type: "object", required, additionalProperties: false,
        properties: Object.fromEntries(required.map((key) => [key, {
          type: "string", minLength: 1,
          ...(key === "ideaId" ? { pattern: "^[0-7][0-9A-HJKMNP-TV-Z]{25}$" } : {}),
        }])),
      },
      levels: [levels[0]!, ...levels.slice(1)] satisfies ObjectiveLevelsManifest,
      defaultLanguage: "en-US",
      languages: ["en-US", "zh-CN"],
      ...(scope === "idea" ? {
        prerequisite: { manifestUri: "../project/manifest.yaml", subject: '{"root": root, "userHome": userHome}' },
      } : {}),
    };
    texts.set(uri, JSON.stringify(manifest));
    const source = new URL("references/", uri).href;
    const resources: { uri: string; source: string }[] = [];
    for (const language of manifest.languages) {
      const chinese = language === "zh-CN";
      const add = (id: string, properties: Record<string, string>, body = "") => {
        resources.push({ uri: new URL(`${id}/${language}.md`, source).href, source: markdown(properties, body) });
      };
      add("system/overview", {
        title: chinese ? `Silvermoon ${scope} 向导` : `Silvermoon ${scope} Guide`,
        description: chinese ? `观测 ${scope} 作用域的整备与目标达成。` : `Observe readiness and objective attainment in ${scope} scope.`,
      });
      add("system/404", {
        title: chinese ? "未找到参考" : "Reference not found",
        description: chinese ? "请求的 Reference ID 不存在。" : "The requested Reference ID does not exist.",
      });
      add("levels/terminal", {
        title: chinese ? "价值达成" : "Objective attained",
        description: chinese ? "本次 probe 的全部 checks 通过。" : "All checks passed in this probe.",
      });
      for (const [id, names, en, zh] of definitions) {
        add(`levels/${id}`, {
          title: chinese ? zh : en,
          description: chinese ? `尚未确认：${zh}。` : `Not yet confirmed: ${en}.`,
          outcome: chinese ? `通过 checks 后确认${zh}并进入下一层。` : `Passing checks confirms ${en.toLowerCase()} and advances.`,
        });
        for (const name of names) add(`checks/${name}`, {
          title: name,
          description: chinese ? `验证 ${name}。` : `Verify ${name}.`,
        });
      }
      for (const id of SILVERMOON_PROBLEM_IDS) {
        add(`problems/${id}`, {
          title: id,
          description: REFERENCE_TEXT[id][chinese ? 1 : 0],
        });
      }
    }
    pages.set(source, resources);
  }
  const resources: ObjectiveResourceResolver = {
    async readText(uri) {
      const source = texts.get(uri);
      if (source === undefined) throw new ObjectiveOperationError(`Missing bundled Objective resource: ${uri}.`);
      return source;
    },
    async readPages(uri) {
      const resources = pages.get(uri);
      if (resources === undefined) throw new ObjectiveOperationError(`Missing bundled References: ${uri}.`);
      return resources;
    },
  };
  return createObjectiveLoader({
    resources,
    checkRunner: {
      async run(_manifestUri, checkId, request) {
        const check = checks[checkId as SilvermoonCheckId];
        if (check === undefined) throw new ObjectiveOperationError(`Missing bundled check: ${checkId}.`);
        return await check(request.subject);
      },
    },
  });
}
