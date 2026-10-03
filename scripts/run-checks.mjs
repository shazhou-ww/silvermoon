import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CHECK_SCRIPTS = Object.freeze([
  "lint:markdown",
  "check:pure",
  "check:quick",
  "test:integration",
  "pack:check",
  "test:e2e",
  "check:skills",
]);

export const CHECK_TIERS = Object.freeze({
  sanity: Object.freeze(["check:syntax", "check:pure", "test:sanity"]),
  commit: Object.freeze([
    "check:sanity",
    "test:contract",
    "lint:markdown",
    "check:skills:local",
    "test:smoke",
    "check:staged",
    "check:diff",
  ]),
  release: CHECK_SCRIPTS,
});

export function selectChecks(args) {
  if (args.length === 0) return CHECK_TIERS.release;
  if (args.length !== 2 || args[0] !== "--tier" || !Object.hasOwn(CHECK_TIERS, args[1])) {
    throw new Error("Usage: node scripts/run-checks.mjs [--tier sanity|commit|release]");
  }
  return CHECK_TIERS[args[1]];
}

export const COMMIT_SCOPE =
  "COMMIT_SCOPE: Tests validate the WORKTREE, not staged code. " +
  "silvermoon check --staged validates only staged Silvermoon metadata. " +
  "Partial staging is NOT exact-candidate test evidence; align index and worktree " +
  "and rerun checks before claiming the staged code passed. No files are staged or changed.\n";

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
  now = () => performance.now(),
  writeOutput = (message) => process.stdout.write(message),
} = {}) {
  if (!Array.isArray(scripts) || scripts.length === 0
    || scripts.some((script) => typeof script !== "string" || !script.trim())) {
    throw new Error("Checks require a non-empty list of script names");
  }
  const totalStartedAt = now();
  const results = await Promise.allSettled(
    scripts.map(async (script) => {
      const scriptStartedAt = now();
      try {
        await runScript(script);
      } finally {
        const elapsedMs = Math.round(now() - scriptStartedAt);
        writeOutput(`CHECK_DURATION ${script} ${elapsedMs}ms\n`);
      }
    }),
  );
  const totalElapsedMs = Math.round(now() - totalStartedAt);
  writeOutput(`CHECK_TOTAL ${totalElapsedMs}ms\n`);
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${scripts[index]}: ${result.reason?.message ?? result.reason}`]
      : [],
  );
  if (failures.length > 0) {
    throw new Error(`Checks failed:\n- ${failures.join("\n- ")}`);
  }
}

export function isMain(importMetaUrl, argv = process.argv) {
  return Boolean(
    argv[1] && importMetaUrl === pathToFileURL(resolve(argv[1])).href,
  );
}

if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const scripts = selectChecks(args);
    if (args[1] === "commit") process.stdout.write(COMMIT_SCOPE);
    await runChecks({ scripts });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
