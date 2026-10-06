import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CHECK_SCRIPTS = Object.freeze([
  "typecheck",
  "build",
  "lint:markdown",
  "check:pure",
  "check:quick",
  "test:integration",
  "pack:check:built",
  "test:e2e:built",
  "check:skills",
]);

export const CHECK_TIERS = Object.freeze({
  sanity: Object.freeze(["typecheck", "build", "check:syntax", "check:pure", "test:sanity"]),
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

type CheckTier = keyof typeof CHECK_TIERS;
type PackageManagerOptions = {
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  platform?: NodeJS.Platform;
};
type RunScriptOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  spawnImpl?: typeof spawn;
};
type RunChecksOptions = {
  scripts?: readonly string[];
  runScript?: (script: string) => Promise<unknown>;
  now?: () => number;
  writeOutput?: (message: string) => unknown;
};

function isCheckTier(value: string): value is CheckTier {
  return value === "sanity" || value === "commit" || value === "release";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function selectChecks(args: readonly string[]): readonly string[] {
  if (args.length === 0) return CHECK_TIERS.release;
  const tier = args[1];
  if (args.length !== 2 || args[0] !== "--tier" || !tier || !isCheckTier(tier)) {
    throw new Error("Usage: node bin/run-checks.ts [--tier sanity|commit|release]");
  }
  return CHECK_TIERS[tier];
}

export const COMMIT_SCOPE =
  "COMMIT_SCOPE: Tests validate the WORKTREE, not staged code. " +
  "silvermoon check --staged validates only staged Silvermoon metadata. " +
  "Partial staging is NOT exact-candidate test evidence; align index and worktree " +
  "and rerun checks before claiming the staged code passed. No files are staged or changed.\n";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export function packageManagerCommand(
  script: string,
  {
    env = process.env,
    execPath = process.execPath,
    platform = process.platform,
  }: PackageManagerOptions = {},
): { command: string; args: string[] } {
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
  script: string,
  {
    cwd = repositoryRoot,
    env = process.env,
    spawnImpl = spawn,
  }: RunScriptOptions = {},
): Promise<void> {
  const { command, args } = packageManagerCommand(script, { env });
  return new Promise<void>((resolve, reject) => {
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
  writeOutput = (message: string) => process.stdout.write(message),
}: RunChecksOptions = {}): Promise<void> {
  if (!Array.isArray(scripts) || scripts.length === 0
    || scripts.some((script) => typeof script !== "string" || !script.trim())) {
    throw new Error("Checks require a non-empty list of script names");
  }
  const totalStartedAt = now();
  const runTimed = async (script: string) => {
    const scriptStartedAt = now();
    try {
      await runScript(script);
    } finally {
      const elapsedMs = Math.round(now() - scriptStartedAt);
      writeOutput(`CHECK_DURATION ${script} ${elapsedMs}ms\n`);
    }
  };
  const prerequisiteNames = new Set(["typecheck", "build"]);
  const prerequisites = scripts.filter((script) => prerequisiteNames.has(script));
  const parallel = scripts.filter((script) => !prerequisiteNames.has(script));
  const entries: [string, PromiseSettledResult<unknown>][] = [];
  for (const script of prerequisites) {
    const [result] = await Promise.allSettled([runTimed(script)]);
    if (result) entries.push([script, result]);
  }
  const parallelResults = await Promise.allSettled(
    parallel.map((script) => runTimed(script)),
  );
  entries.push(...parallel.map((script, index) => [
    script,
    parallelResults[index] as PromiseSettledResult<unknown>,
  ] satisfies [string, PromiseSettledResult<unknown>]));
  const totalElapsedMs = Math.round(now() - totalStartedAt);
  writeOutput(`CHECK_TOTAL ${totalElapsedMs}ms\n`);
  const failures = entries.flatMap(([script, result]) =>
    result.status === "rejected"
      ? [`${script}: ${errorMessage(result.reason)}`]
      : [],
  );
  if (failures.length > 0) {
    throw new Error(`Checks failed:\n- ${failures.join("\n- ")}`);
  }
}

export function isMain(importMetaUrl: string, argv: readonly string[] = process.argv): boolean {
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
  } catch (error: unknown) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
