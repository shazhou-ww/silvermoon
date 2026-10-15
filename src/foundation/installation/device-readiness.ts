import { execFile } from "node:child_process";
import type { ExecFileOptionsWithStringEncoding } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { npmCommand } from "../process/index.ts";
import {
  compareSemanticVersions,
  parseSemanticVersion,
  resolveRuntimeUpdateChannel,
} from "./rules.ts";
import { directoryContentRevision } from "./skill-content-revision.ts";

const packageRoot = fileURLToPath(new URL(
  import.meta.url.endsWith(".ts") ? "../../.." : "../../../..",
  import.meta.url,
));
const packagedSkill = resolve(packageRoot, "skills", "silvermoon");
const CACHE_PATH = ".cache/silvermoon/runtime-latest.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PERSONAL_SKILL_PATHS = [
  ".agents/skills/silvermoon",
  ".copilot/skills/silvermoon",
] as const;
const executeFile = promisify(execFile);

interface ReadinessFileSystem {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  realpath: typeof realpath;
  writeFile: typeof writeFile;
}

interface LatestCache {
  version: 2;
  channel: string;
  checkedAt: string;
  latestVersion: string;
}

type NpmExecutor = (
  command: string,
  args: string[],
  options: ExecFileOptionsWithStringEncoding,
) => Promise<{ stdout: string; stderr: string }>;

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error
    && typeof error.code === "string" ? error.code : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function validCache(value: unknown, channel: string): value is LatestCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cache = value as Partial<LatestCache>;
  return cache.version === 2
    && cache.channel === channel
    && typeof cache.checkedAt === "string"
    && Number.isFinite(Date.parse(cache.checkedAt))
    && parseSemanticVersion(cache.latestVersion) !== null;
}

async function readCache(
  path: string,
  channel: string,
  filesystem: Pick<ReadinessFileSystem, "readFile">,
) {
  try {
    const parsed: unknown = JSON.parse(await filesystem.readFile(path, "utf8"));
    return validCache(parsed, channel) ? parsed : null;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function executeNpm(
  command: string,
  args: string[],
  options: ExecFileOptionsWithStringEncoding,
) {
  return executeFile(command, args, options);
}

export async function npmRegistryLatest(channel: string, {
  cwd = process.cwd(),
  env = process.env,
  execPath = process.execPath,
  execute = executeNpm,
  platform = process.platform,
}: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  execute?: NpmExecutor;
  platform?: NodeJS.Platform;
} = {}) {
  const invocation = npmCommand(
    ["view", `silvermoon@${channel}`, "version", "--json"],
    { env, execPath, platform },
  );
  let stdout: string;
  try {
    ({ stdout } = await execute(invocation.command, invocation.args, {
      cwd,
      encoding: "utf8",
      env,
      maxBuffer: 64 * 1024,
      timeout: 5000,
      windowsHide: true,
    }));
  } catch (error) {
    throw new Error(
      `npm view failed for silvermoon@${channel}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  let version: unknown;
  try {
    version = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `npm returned an invalid ${channel} version response.`,
      { cause: error },
    );
  }
  if (typeof version !== "string" || parseSemanticVersion(version) === null) {
    throw new Error(`npm returned an invalid ${channel} version.`);
  }
  return version;
}

export async function inspectRuntimeUpdate({
  currentVersion,
  env = process.env,
  filesystem = { lstat, mkdir, readFile, realpath, writeFile },
  force = false,
  home = homedir(),
  now = Date.now(),
  requestLatest,
}: {
  currentVersion: string | null;
  env?: NodeJS.ProcessEnv;
  filesystem?: ReadinessFileSystem;
  force?: boolean;
  home?: string;
  now?: number;
  requestLatest?: (channel: string) => Promise<string>;
}) {
  const cachePath = resolve(home, CACHE_PATH);
  if (!Number.isFinite(now)) {
    return {
      status: "unavailable" as const,
      currentVersion,
      source: "runtime" as const,
      summary: "The runtime freshness clock is invalid.",
    };
  }
  const channel = resolveRuntimeUpdateChannel(currentVersion);
  if (channel === null) {
    return {
      status: "unavailable" as const,
      currentVersion,
      source: "runtime" as const,
      summary: "The running Silvermoon package has an invalid version.",
    };
  }
  let cached: LatestCache | null = null;
  let cacheWarning: string | undefined;
  try {
    cached = await readCache(cachePath, channel, filesystem);
  } catch (error) {
    cacheWarning = `Cannot read the runtime freshness cache: ${errorMessage(error)}`;
  }
  const checkedAt = cached ? Date.parse(cached.checkedAt) : Number.NaN;
  let latestVersion: string;
  let source: "cache" | "registry";
  let latestCheckedAt: string;
  if (!force && cached && now - checkedAt >= 0 && now - checkedAt < CACHE_TTL_MS) {
    latestVersion = cached.latestVersion;
    source = "cache";
    latestCheckedAt = cached.checkedAt;
  } else {
    try {
      latestVersion = await (
        requestLatest ?? ((requestedChannel) =>
          npmRegistryLatest(requestedChannel, { env }))
      )(channel);
    } catch (error) {
      return {
        status: "unavailable" as const,
        channel,
        currentVersion,
        source: "registry" as const,
        ...(cached === null
          ? {}
          : {
            lastSuccessfulCheck: {
              channel: cached.channel,
              checkedAt: cached.checkedAt,
              latestVersion: cached.latestVersion,
            },
          }),
        summary: [
          cacheWarning,
          `Cannot confirm the Silvermoon ${channel} version: ${errorMessage(error)}`,
        ].filter(Boolean).join(" "),
      };
    }
    if (parseSemanticVersion(latestVersion) === null) {
      return {
        status: "unavailable" as const,
        channel,
        currentVersion,
        source: "registry" as const,
        summary: [
          cacheWarning,
          `Runtime ${channel} resolver returned an invalid version.`,
        ].filter(Boolean).join(" "),
      };
    }
    latestCheckedAt = new Date(now).toISOString();
    try {
      await filesystem.mkdir(resolve(cachePath, ".."), { recursive: true });
      await filesystem.writeFile(
        cachePath,
        `${JSON.stringify({
          version: 2,
          channel,
          checkedAt: latestCheckedAt,
          latestVersion,
        })}\n`,
        { mode: 0o600 },
      );
    } catch (error) {
      const comparison = compareSemanticVersions(currentVersion, latestVersion);
      const updateAvailable = comparison !== null && comparison < 0;
      const summaries = [
        cacheWarning,
        updateAvailable
          ? `Upgrade the global Silvermoon ${channel} runtime to ${latestVersion}.`
          : undefined,
        `Confirmed the Silvermoon ${channel} version but could not cache the result: ${errorMessage(error)}`,
      ].filter((value): value is string => value !== undefined);
      return {
        status: updateAvailable
          ? "available" as const
          : "current" as const,
        channel,
        currentVersion,
        latestVersion,
        checkedAt: latestCheckedAt,
        source: "registry" as const,
        summary: summaries.join(" "),
      };
    }
    source = "registry";
  }
  const comparison = compareSemanticVersions(currentVersion, latestVersion);
  if (comparison === null) {
    return {
      status: "unavailable" as const,
      channel,
      currentVersion,
      source,
      summary: `Cannot compare the running and ${channel} Silvermoon versions.`,
    };
  }
  const updateAvailable = comparison < 0;
  const summaries = [
    cacheWarning,
    updateAvailable
      ? `Upgrade the global Silvermoon ${channel} runtime to ${latestVersion}.`
      : undefined,
  ].filter((value): value is string => value !== undefined);
  return {
    status: updateAvailable ? "available" as const : "current" as const,
    channel,
    currentVersion,
    latestVersion,
    checkedAt: latestCheckedAt,
    source,
    ...(summaries.length === 0 ? {} : { summary: summaries.join(" ") }),
  };
}

export async function inspectPersonalSkill({
  filesystem = { lstat, mkdir, readFile, realpath, writeFile },
  home = homedir(),
  runtimeSource,
  skillRoot = packagedSkill,
}: {
  filesystem?: ReadinessFileSystem;
  home?: string;
  runtimeSource: string;
  skillRoot?: string;
}) {
  if (runtimeSource !== "global") {
    const expectedRoot = resolve(skillRoot);
    return {
      status: runtimeSource === "source-checkout"
        ? "source-checkout" as const
        : "managed-by-host" as const,
      expectedRoot,
      paths: [],
      ...(runtimeSource === "source-checkout"
        ? {
            remediation:
              `Link this checkout as the device-level global Silvermoon runtime, register ${expectedRoot} by link in a personal discovery path, and rerun with silvermoon.`,
          }
        : {}),
    };
  }
  let expectedRoot = resolve(skillRoot);
  let expectedRevision: string;
  try {
    expectedRoot = await filesystem.realpath(skillRoot);
    await filesystem.readFile(resolve(expectedRoot, "SKILL.md"), "utf8");
    expectedRevision = await directoryContentRevision(expectedRoot);
  } catch (error) {
    return {
      status: "canonical-unverifiable" as const,
      expectedRoot,
      paths: [],
      remediation: `Repair the active Silvermoon runtime so its canonical skill at ${expectedRoot} can be verified.`,
      summary: `Cannot verify the active runtime's canonical Silvermoon skill: ${errorMessage(error)}`,
    };
  }
  const paths = [];
  const observed: Array<{ path: string; revision: string | null }> = [];
  for (const relativePath of PERSONAL_SKILL_PATHS) {
    const path = resolve(home, relativePath);
    try {
      const metadata = await filesystem.lstat(path);
      if (!metadata.isDirectory() && !metadata.isSymbolicLink()) {
        observed.push({ path, revision: null });
        continue;
      }
      let target: string;
      try {
        target = await filesystem.realpath(path);
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          observed.push({ path, revision: null });
          continue;
        }
        throw error;
      }
      let revision: string | null = null;
      try {
        await filesystem.readFile(resolve(target, "SKILL.md"), "utf8");
        revision = await directoryContentRevision(target);
      } catch {
        observed.push({ path, revision: null });
        continue;
      }
      observed.push({ path, revision });
      if (revision === expectedRevision) {
        paths.push(path);
      }
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        return {
          status: "incorrect" as const,
          expectedRoot,
          expectedRevision,
          paths,
          observed: [...observed, { path, revision: null }],
          remediation: `Run npx skills add "${expectedRoot}" --global --all to install the active runtime's canonical skill, then rerun the Silvermoon command.`,
          summary: `Cannot inspect personal Silvermoon skill ${path}: ${errorMessage(error)}`,
        };
      }
    }
  }
  if (observed.length > paths.length) {
    return {
      status: "incorrect" as const,
      expectedRoot,
      expectedRevision,
      paths,
      observed,
      remediation: `Run npx skills add "${expectedRoot}" --global --all to install the active runtime's canonical skill so its content revision matches ${expectedRevision}, then rerun the Silvermoon command.`,
      summary: "A discovered personal Silvermoon skill does not match the active runtime's canonical skill content revision.",
    };
  }
  if (paths.length === 0) {
    return {
      status: "missing" as const,
      expectedRoot,
      expectedRevision,
      paths,
      remediation: `Run npx skills add "${expectedRoot}" --global --all to install the active runtime's canonical skill, then rerun the Silvermoon command.`,
    };
  }
  return {
    status: "ready" as const,
    expectedRoot,
    expectedRevision,
    paths,
    observed,
  };
}

export { CACHE_TTL_MS, PERSONAL_SKILL_PATHS };
