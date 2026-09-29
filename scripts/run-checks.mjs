import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CHECK_SCRIPTS = Object.freeze([
  "lint:markdown",
  "check:quick",
  "test:integration",
  "pack:check",
  "test:e2e",
  "check:skills",
]);

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export function packageManagerCommand(
  script,
  {
    env = process.env,
    execPath = process.execPath,
    platform = process.platform,
  } = {},
) {
  if (env.npm_execpath) {
    if (platform === "win32" && /\.exe$/i.test(env.npm_execpath)) {
      return {
        command: env.npm_execpath,
        args: ["run", script],
      };
    }
    return {
      command: execPath,
      args: [env.npm_execpath, "run", script],
    };
  }
  if (platform === "win32") {
    return {
      command: env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `npm run ${script}`],
    };
  }
  return { command: "npm", args: ["run", script] };
}

export function runCheckScript(
  script,
  {
    cwd = repositoryRoot,
    env = process.env,
    spawnImpl = spawn,
  } = {},
) {
  const { command, args } = packageManagerCommand(script, { env });
  return new Promise((resolve, reject) => {
    process.stdout.write(`CHECK_START ${script}\n`);
    const child = spawnImpl(command, args, {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => {
      reject(new Error(`${script} could not start: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      if (code === 0) {
        process.stdout.write(`CHECK_OK ${script}\n`);
        resolve();
        return;
      }
      const result = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${script} failed with ${result}`));
    });
  });
}

export async function runChecks({
  scripts = CHECK_SCRIPTS,
  runScript = runCheckScript,
} = {}) {
  const results = await Promise.allSettled(
    scripts.map((script) => runScript(script)),
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${scripts[index]}: ${result.reason?.message ?? result.reason}`]
      : [],
  );
  if (failures.length > 0) {
    throw new Error(`Release-grade checks failed:\n- ${failures.join("\n- ")}`);
  }
}

export function isMain(importMetaUrl, argv = process.argv) {
  return Boolean(
    argv[1] && importMetaUrl === pathToFileURL(resolve(argv[1])).href,
  );
}

if (isMain(import.meta.url)) {
  try {
    await runChecks();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
