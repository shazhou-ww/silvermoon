import { inspectInstallation } from "../../foundation/installation/index.js";
import { loadUserConfig } from "../../foundation/device-config/index.js";

export async function observeDevice({
  entryPath,
  env,
  platform,
  userHome,
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
