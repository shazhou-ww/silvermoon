import { createObjectiveLoader, ObjectiveOperationError } from "../objective-guide/index.ts";
import type {
  ObjectiveCheck, ObjectiveGuideManifest, ObjectiveLevelsManifest, ObjectiveLoader,
  ObjectiveResourceResolver,
  ObjectiveGuideInstance,
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
export type SilvermoonObjectiveChecks = Readonly<Record<SilvermoonCheckId, ObjectiveCheck>>;
export function probeObjective(instance: ObjectiveGuideInstance) {
  return instance.probe();
}
export const SILVERMOON_REFERENCE_IDS = Object.freeze([
  "404", "project", "repository", "guidance", "ideal", "inner", "outer",
  "idea-configuration", "idea-inactive", "device-configuration", "device-runtime",
  "device-skill", "device-update",
] as const);

const REFERENCE_TEXT = {
  project: [
    "Repair the reported project configuration, schema or layout first. Preserve unknown work. Reobserve with the exact original command and selector. Runtime refresh and migration are distinct from configuration validity.",
    "先修复报告中的项目配置、schema 或目录问题，保留未知工作。用原命令和 selector 重新观测；运行时刷新和 migration 不等于配置合法性。",
  ],
  repository: [
    "Inspect all staged, unstaged, untracked and conflicting work. Preserve it, validate the exact candidate, then synchronize by ordinary Git against the reported primary. Never reset, force-push or replay a stale decision.",
    "检查全部 staged、unstaged、untracked 和冲突工作并保留它们。验证准确候选后按报告的 primary 普通同步，不 reset、force-push 或重放过期决定。",
  ],
  guidance: [
    "Project owns all preparing, implementing and deploying guidance. Missing files are allowed; invalid files block project readiness. Consume phase content only from the snapshot-bound report.",
    "Project 持有 preparing、implementing、deploying guidance；缺失正常，非法则阻塞项目整备。阶段正文只能消费 snapshot-bound 报告中的内容。",
  ],
  ideal: [
    "Prepare the Ideal contract and lightweight downstream seeds. Synchronize the exact revision, submitIdeal, present its review index, and record acceptIdeal only after the explicit decision. Submission is not acceptance.",
    "整备 Ideal 契约与轻量下游初版，同步准确 revision 后 submitIdeal、呈现审阅索引，再按明确决定记录 acceptIdeal；提交不等于接受。",
  ],
  inner: [
    "Implement within the accepted Ideal boundary. Verify all implementation steps and acceptance criteria, synchronize evidence and the exact Inner revision, submitInner, then wait for its explicit acceptInner.",
    "在已接受 Ideal 边界内实现并验证步骤和验收标准，同步证据与准确 Inner revision，submitInner 后等待明确 acceptInner。",
  ],
  outer: [
    "Verify real deployment outcomes against the accepted implementation. Synchronize the exact Outer revision and evidence, submitOuter, then wait for its explicit acceptOuter. Do not infer completion.",
    "按已接受实现验证现实部署结果，同步准确 Outer revision 与证据，submitOuter 后等待明确 acceptOuter；不推断完成。",
  ],
  "idea-configuration": [
    "Repair the selected Idea's metadata, language, world entries and ledger structure. Do not replace status facts with ledger marks. Reobserve; project inventory is not a permanent guarantee.",
    "修复所选 Idea 的 metadata、语言、world 入口与 ledger 结构，不用 ledger 勾选替代状态事实。重新观测，项目 inventory 不是永久保证。",
  ],
  "idea-inactive": [
    "An abandoned Idea is stopped, not completed. Resume only after an explicit reversal; do not request acceptance.",
    "abandoned Idea 已停止而非完成。仅在明确反转后 resume，不请求接受。",
  ],
  "device-configuration": ["Repair the personal configuration; omitted optional configuration uses existing defaults.", "修复个人配置；允许缺省的配置沿用现有默认值。"],
  "device-runtime": ["Run pnpm setup:dev in this source checkout and use its linked global silvermoon runtime.", "在本源码 checkout 运行 pnpm setup:dev，并使用其链接的全局 silvermoon。"],
  "device-skill": ["Link the personal discovery path to the runtime's canonical skills/silvermoon. Do not copy or add a repository-local skill.", "将 personal discovery 链接到运行时的 canonical skills/silvermoon，不复制或新增项目内 skill。"],
  "device-update": ["Follow the reported runtime channel and host ownership. Registry failure means unknown, not current; device advisory does not block project readiness.", "遵循报告的更新 channel 与 host ownership；registry 失败代表未知，不是 current。设备 advisory 不阻塞项目。"],
} as const;

export function createSilvermoonObjectiveLoader(checks: SilvermoonObjectiveChecks): ObjectiveLoader {
  const texts = new Map<string, string>();
  const pages = new Map<string, { uri: string; source: string }[]>();
  for (const scope of ["device", "project", "idea"] as const) {
    const uri = SILVERMOON_OBJECTIVE_URIS[scope];
    const definitions = SILVERMOON_OBJECTIVE_LEVELS[scope];
    const levels = definitions.map(([id, names]) => ({ id, advancement: { checks: [...names] } }));
    const localizations = {
      "en-US": { content: "en-US/content.yaml", references: { source: "en-US/references/" } },
      "zh-CN": { content: "zh-CN/content.yaml", references: { source: "zh-CN/references/" } },
    };
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
      defaultLanguage: "en-US", localizations,
      ...(scope === "idea" ? { prerequisite: { manifestUri: "../project/manifest.yaml", subject: '{"root": root, "userHome": userHome}' } } : {}),
    };
    texts.set(uri, JSON.stringify(manifest));
    for (const [language, locale] of Object.entries(localizations)) {
      const chinese = language === "zh-CN";
      texts.set(new URL(locale.content, uri).href, JSON.stringify({
        title: chinese ? `Silvermoon ${scope} 向导` : `Silvermoon ${scope} Guide`,
        description: chinese ? `观测 ${scope} 作用域的整备与目标达成。` : `Observe readiness and objective attainment in ${scope} scope.`,
        terminal: { title: chinese ? "价值达成" : "Objective attained",
          description: chinese ? "本轮全部 advancement checks 通过。" : "All advancement checks passed in this sample." },
        levels: Object.fromEntries(definitions.map(([id, , en, zh]) => [id, {
          title: chinese ? zh : en,
          description: chinese ? `尚未确认：${zh}。` : `Not yet confirmed: ${en}.`,
          outcome: chinese ? `停留时承担未满足此目标的代价；通过检查后可确认${zh}，再进入下一层。`
            : `Staying accepts the cost of this unmet objective; passing confirms ${en.toLowerCase()} before advancing.`,
        }])),
      }));
      const source = new URL(locale.references.source, uri).href;
      pages.set(source, SILVERMOON_REFERENCE_IDS.map((id) => {
        const body = id === "404"
          ? chinese ? "未找到该配置或参考页面。检查请求 ID 与对应 Guide，不隐瞒读取错误。" : "The requested configuration or reference page was not found. Verify the ID and owning Guide; do not conceal read errors."
          : REFERENCE_TEXT[id][chinese ? 1 : 0];
        return { uri: new URL(`${id}.md`, source).href,
          source: `---\nid: ${JSON.stringify(id)}\n---\n# ${id}\n\n${body}\n` };
      }));
    }
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
  return createObjectiveLoader({ resources, checks });
}
