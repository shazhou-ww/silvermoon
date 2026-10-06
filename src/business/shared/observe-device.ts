import { inspectInstallation } from "../../foundation/installation/index.ts";
import { loadUserConfig } from "../../foundation/device-config/index.ts";

export async function observeDevice({
  entryPath,
  env,
  platform,
  userHome,
}: {
  entryPath?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  userHome?: string | undefined;
} = {}) {
  const [runtime, user] = await Promise.all([
    inspectInstallation({ entryPath, env, platform }),
    loadUserConfig({ home: userHome }),
  ]);
  return {
    runtime,
    globalConfig: {
      path: user.configPath,
      present: user.config !== null,
      valid: user.diagnostics.length === 0,
    },
    diagnostics: user.diagnostics,
    user,
  };
}
