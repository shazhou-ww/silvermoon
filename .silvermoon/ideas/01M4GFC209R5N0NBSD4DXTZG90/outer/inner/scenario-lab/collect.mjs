import { mkdir, readFile, writeFile } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const labRoot = "/scenario-lab";
const projectRoot = "/workspace";
const globalBin = `${process.env.HOME}/.npm-global/bin`;
const globalSilvermoon = `${globalBin}/silvermoon`;
const skillLink = `${process.env.HOME}/.agents/skills/silvermoon`;
const source = JSON.parse(await readFile(resolve(labRoot, "scenarios.json"), "utf8"));
if (!Array.isArray(source.scenarios) || source.scenarios.length === 0) {
  throw new TypeError("Scenario manifest must contain at least one scenario.");
}

const outputDirectory = resolve(
  labRoot,
  "corpus",
  new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(outputDirectory, { recursive: true });

function runSilvermoon(args) {
  return runCommand("silvermoon", args);
}

function runCommand(command, args, env = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", rejectRun);
    child.once("close", (code, signal) => resolveRun({
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

const executeFile = promisify(execFile);
async function prepareState(state) {
  const userConfigPath = `${process.env.HOME}/.config/silvermoon/config.yaml`;
  await writeFile(userConfigPath, "version: 1\npreferredLanguage: zh-CN\n", "utf8");
  await executeFile("pnpm", ["link:skill"], { cwd: "/checkout" });
  if (state === "baseline") return;
  if (state === "invalid-user-config") {
    await writeFile(userConfigPath, "version: invalid\n", "utf8");
    return;
  }
  if (state === "skill-link-missing") {
    await unlink(skillLink);
    return;
  }
  if (state === "global-runtime-path-masked") return;
  throw new TypeError(`Unsupported initial scenario state: ${state}`);
}

const startedAt = new Date().toISOString();
const results = [];
for (const scenario of source.scenarios) {
  if (
    typeof scenario.id !== "string"
    || !/^[a-z0-9-]+$/.test(scenario.id)
    || !Array.isArray(scenario.languages)
    || scenario.languages.some((language) => !["en-US", "zh-CN"].includes(language))
  ) {
    throw new TypeError("Each scenario needs a stable ID and supported output languages.");
  }
  await prepareState(scenario.state ?? "baseline");
  for (const language of scenario.languages) {
    const args = ["whats-next"];
    if (scenario.idea !== undefined) args.push(scenario.idea);
    args.push("--root", projectRoot, "--language", language, "--audience", "agent");

    const hideGlobalRuntime = scenario.state === "global-runtime-path-masked";
    const command = hideGlobalRuntime ? globalSilvermoon : "silvermoon";
    const env = hideGlobalRuntime
      ? {
          ...process.env,
          PATH: (process.env.PATH ?? "")
            .split(":")
            .filter((entry) => entry !== globalBin)
            .join(":"),
        }
      : process.env;
    const result = await runCommand(command, args, env);
    const stem = `${scenario.id}.${language}`;
    const stdoutPath = `${stem}.md`;
    const stderrPath = result.stderr === "" ? undefined : `${stem}.stderr.txt`;
    await writeFile(resolve(outputDirectory, stdoutPath), result.stdout, "utf8");
    if (stderrPath !== undefined) {
      await writeFile(resolve(outputDirectory, stderrPath), result.stderr, "utf8");
    }
    results.push({
      scenario: scenario.id,
      state: scenario.state ?? "baseline",
      idea: scenario.idea ?? null,
      language,
      command: [command, ...args],
      exitCode: result.code,
      signal: result.signal,
      stdout: stdoutPath,
      ...(stderrPath === undefined ? {} : { stderr: stderrPath }),
    });
    if (result.code !== 0) {
      throw new Error(
        `silvermoon whats-next failed for ${scenario.id}/${language} `
        + `with exit code ${result.code ?? "unknown"}.`,
      );
    }
  }
}

await prepareState("baseline");
const versionResult = await runSilvermoon(["--version"]);
if (versionResult.code !== 0) {
  throw new Error(`Cannot read linked Silvermoon version (exit ${versionResult.code}).`);
}
await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify({
    sourceRevision: process.env.SCENARIO_SOURCE_REVISION ?? "unknown",
    sourceDirty: process.env.SCENARIO_SOURCE_DIRTY ?? "unknown",
    silvermoonVersion: versionResult.stdout.trim(),
    projectRoot,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(`Collected ${results.length} reports in ${outputDirectory}\n`);
