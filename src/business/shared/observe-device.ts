import {
  inspectInstallation,
  inspectPersonalSkill,
  inspectRuntimeUpdate,
} from "../../foundation/installation/index.ts";
import { loadUserConfig } from "../../foundation/device-config/index.ts";

export async function observeDevice({
  entryPath,
  env,
  includeReadiness = true,
  platform,
  userHome,
}: {
  entryPath?: string;
  env?: NodeJS.ProcessEnv;
  includeReadiness?: boolean;
  platform?: NodeJS.Platform;
  userHome?: string | undefined;
} = {}) {
  const userPromise = loadUserConfig({ home: userHome });
  if (!includeReadiness) {
    const user = await userPromise;
    return {
      runtime: null,
      globalConfig: {
        path: user.configPath,
        present: user.config !== null,
        valid: user.diagnostics.length === 0,
      },
      diagnostics: user.diagnostics,
      user,
    };
  }
  const [runtime, user] = await Promise.all([
    inspectInstallation({
      ...(entryPath === undefined ? {} : { entryPath }),
      ...(env === undefined ? {} : { env }),
      ...(platform === undefined ? {} : { platform }),
    }),
    userPromise,
  ]);
  const [skill, update] = await Promise.all([
    inspectPersonalSkill({
      ...(userHome === undefined ? {} : { home: userHome }),
      runtimeSource: runtime.source,
    }),
    runtime.source === "global"
      ? inspectRuntimeUpdate({
        currentVersion: runtime.version,
        ...(userHome === undefined ? {} : { home: userHome }),
      })
      : Promise.resolve({
        status: runtime.source === "source-checkout"
          ? "source-checkout" as const
          : "managed-by-host" as const,
        currentVersion: runtime.version,
        source: "runtime" as const,
        summary: runtime.source === "source-checkout"
          ? "The source checkout is the active development runtime; npm latest status is advisory only for global installations."
          : "The embedding host owns Silvermoon runtime updates.",
      }),
  ]);
  const readiness = {
    runtime: {
      source: runtime.source,
      version: runtime.version,
      ...(runtime.versionError === undefined
        ? {}
        : { summary: runtime.versionError }),
    },
    skill,
    update,
  };
  return {
    runtime,
    readiness,
    globalConfig: {
      path: user.configPath,
      present: user.config !== null,
      valid: user.diagnostics.length === 0,
    },
    diagnostics: user.diagnostics,
    user,
  };
}
