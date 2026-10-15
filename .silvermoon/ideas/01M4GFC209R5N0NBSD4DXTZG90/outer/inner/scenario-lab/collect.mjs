import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const labRoot = "/scenario-lab";
const projectRoot = "/workspace";
const checkoutLabRoot = "/checkout/.silvermoon/ideas/01M4GFC209R5N0NBSD4DXTZG90/outer/inner/scenario-lab";
const globalBin = `${process.env.HOME}/.npm-global/bin`;
const globalSilvermoon = `${globalBin}/silvermoon`;
const skillLink = `${process.env.HOME}/.agents/skills/silvermoon`;
const source = JSON.parse(await readFile(resolve(labRoot, "scenarios.json"), "utf8"));
if (!Array.isArray(source.scenarios) || source.scenarios.length === 0) {
  throw new TypeError("Scenario manifest must contain at least one scenario.");
}
const flowFields = [
  "objective",
  "check",
  "branch",
  "previousState",
  "transitionAction",
  "currentState",
  "nextAction",
];
const scenarioIds = new Set();
for (const scenario of source.scenarios) {
  if (
    typeof scenario.id !== "string"
    || !/^[a-z0-9-]+$/.test(scenario.id)
    || scenarioIds.has(scenario.id)
    || !Array.isArray(scenario.languages)
    || scenario.languages.length === 0
    || scenario.languages.some((language) => !["en-US", "zh-CN"].includes(language))
    || scenario.flow === null
    || typeof scenario.flow !== "object"
    || flowFields.some(
      (field) => typeof scenario.flow[field] !== "string"
        || scenario.flow[field].trim() === "",
    )
  ) {
    throw new TypeError(
      "Each scenario needs a unique stable ID, supported output languages, "
      + "and complete transition context.",
    );
  }
  scenarioIds.add(scenario.id);
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
async function restoreRepository() {
  await rm(resolve(projectRoot, "scenario-untracked.txt"), { force: true });
  await executeFile("git", ["switch", "scenario"], { cwd: projectRoot });
  await executeFile(
    "git",
    ["branch", "--set-upstream-to=origin/main", "scenario"],
    { cwd: projectRoot },
  );
}

async function prepareState(state) {
  await restoreRepository();
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
  if (state === "worktree-untracked") {
    await writeFile(
      resolve(projectRoot, "scenario-untracked.txt"),
      "scenario-owned untracked change\n",
      "utf8",
    );
    return;
  }
  if (state === "detached-head") {
    await executeFile("git", ["switch", "--detach", "origin/main"], {
      cwd: projectRoot,
    });
    return;
  }
  if (state === "upstream-missing") {
    await executeFile("git", ["branch", "--unset-upstream"], {
      cwd: projectRoot,
    });
    return;
  }
  throw new TypeError(`Unsupported initial scenario state: ${state}`);
}

const startedAt = new Date().toISOString();
const results = [];
for (const scenario of source.scenarios) {
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
    sourceDirty: process.env.SCENARIO_SOURCE_DIRTY === "true",
    dependencyRegistry: process.env.COREPACK_NPM_REGISTRY ?? "unknown",
    silvermoonVersion: versionResult.stdout.trim(),
    projectRoot,
    startedAt,
    finishedAt: new Date().toISOString(),
    scenarioDefinitions: source.scenarios.map((scenario) => ({
      id: scenario.id,
      state: scenario.state ?? "baseline",
      idea: scenario.idea ?? null,
      flow: scenario.flow,
    })),
    results,
  }, null, 2)}\n`,
  "utf8",
);
const { buildReviewPage } = await import(
  `${checkoutLabRoot}/build-review-page.mjs`
);
await buildReviewPage({ labRoot, outputDirectory });

process.stdout.write(`Collected ${results.length} reports in ${outputDirectory}\n`);
