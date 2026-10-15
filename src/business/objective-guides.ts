import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createObjectiveLoader, fileObjectiveCheckRunner, fileObjectiveResources,
  ObjectiveOperationError,
} from "../objective-guide/index.ts";
import type {
  CheckResult, ObjectiveGuideInstance, ObjectiveLoader, ObjectiveSubject,
} from "../objective-guide/index.ts";

export const SILVERMOON_OBJECTIVE_URIS = Object.freeze({
  device: new URL("./objectives/device/manifest.yaml", import.meta.url).href,
  project: new URL("./objectives/project/manifest.yaml", import.meta.url).href,
  idea: new URL("./objectives/idea/manifest.yaml", import.meta.url).href,
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
export const SILVERMOON_CHECK_PROBLEMS = Object.freeze({
  "device-config-valid": ["device-configuration"],
  "device-runtime-linked": ["device-runtime"],
  "device-skill-discoverable": ["device-skill"],
  "device-update-current": ["device-update"],
  "project-config-valid": ["project-configuration"],
  "project-user-config-valid": ["project-user-configuration"],
  "project-layout-valid": ["project-layout"],
  "project-adopted": ["project-adoption"],
  "project-schema-ready": ["project-schema"],
  "project-guidance-valid": ["project-guidance"],
  "repository-worktree-clean": ["repository-worktree"],
  "repository-head-present": ["repository-head"],
  "repository-upstream-matches": ["repository-upstream"],
  "repository-primary-fetched": ["repository-primary-fetch"],
  "repository-primary-aligned": ["repository-primary-alignment"],
  "repository-event-history-valid": ["repository-event-history"],
  "project-primary-guidance-valid": ["project-primary-guidance"],
  "idea-metadata-valid": [
    "idea-selection-changed",
    "idea-metadata",
    "idea-revision-changed",
    "idea-guidance",
    "idea-inactive",
  ],
  "idea-contracts-valid": ["idea-contracts"],
  "idea-ideal-submitted": ["ideal-unsubmitted"],
  "idea-ideal-accepted": ["ideal-unaccepted"],
  "idea-inner-submitted": ["implementation-unsubmitted"],
  "idea-inner-accepted": ["implementation-unaccepted"],
  "idea-outer-submitted": ["deployment-unsubmitted"],
  "idea-outer-accepted": ["deployment-unaccepted"],
} as const);
export type SilvermoonCheckId = keyof typeof SILVERMOON_CHECK_PROBLEMS;
export type SilvermoonObjectiveCheck = (subject: ObjectiveSubject) => Promise<CheckResult>;
export type SilvermoonObjectiveChecks = Readonly<Record<SilvermoonCheckId, SilvermoonObjectiveCheck>>;
export interface SilvermoonObjectiveLoaderOptions {
  executeEntries?: boolean;
}

export function probeObjective(instance: ObjectiveGuideInstance) {
  return instance.probe();
}

export function createSilvermoonObjectiveLoader(
  checks: SilvermoonObjectiveChecks,
  { executeEntries = true }: SilvermoonObjectiveLoaderOptions = {},
): ObjectiveLoader {
  return createObjectiveLoader({
    resources: fileObjectiveResources,
    checkRunner: {
      async validate(manifestUri, checkId) {
        if (executeEntries) await fileObjectiveCheckRunner.validate!(manifestUri, checkId);
      },
      async run(manifestUri, checkId, request, signal) {
        const check = checks[checkId as SilvermoonCheckId];
        if (check === undefined) throw new ObjectiveOperationError(`Missing bundled check: ${checkId}.`);
        const result = await check(request.subject);
        if (!executeEntries) return result;
        const directory = join(request.probe.tempDirectory, "silvermoon-check-results");
        await mkdir(directory, { recursive: true });
        const target = join(directory, `${checkId}.json`);
        const pending = `${target}.pending`;
        await writeFile(pending, JSON.stringify(result), "utf8");
        await rename(pending, target);
        return await fileObjectiveCheckRunner.run(
          manifestUri,
          checkId,
          request,
          signal,
        );
      },
    },
  });
}
