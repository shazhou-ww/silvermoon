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

import {
  compareSemanticVersions,
  parseSemanticVersion,
  resolveRuntimeUpdateChannel,
} from "./rules.ts";

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

async function registryLatest(channel: string) {
  const response = await fetch(
    `https://registry.npmjs.org/silvermoon/${encodeURIComponent(channel)}`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) {
    throw new Error(`npm registry returned HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  const version = body && typeof body === "object" && "version" in body
    ? body.version
    : null;
  if (typeof version !== "string" || parseSemanticVersion(version) === null) {
    throw new Error(`npm registry returned an invalid ${channel} version`);
  }
  return version;
}

export async function inspectRuntimeUpdate({
  currentVersion,
  filesystem = { lstat, mkdir, readFile, realpath, writeFile },
  force = false,
  home = homedir(),
  now = Date.now(),
  requestLatest = registryLatest,
}: {
  currentVersion: string | null;
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
      latestVersion = await requestLatest(channel);
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
  try {
    expectedRoot = await filesystem.realpath(skillRoot);
    await filesystem.readFile(resolve(expectedRoot, "SKILL.md"), "utf8");
  } catch (error) {
    return {
      status: "invalid" as const,
      expectedRoot,
      paths: [],
      remediation: `Repair the Silvermoon installation so ${expectedRoot} contains a readable SKILL.md.`,
      summary: `Cannot read the installed canonical Silvermoon skill: ${errorMessage(error)}`,
    };
  }
  const paths = [];
  const invalidPaths = [];
  const invalidTargets: Array<{ path: string; target: string | null }> = [];
  for (const relativePath of PERSONAL_SKILL_PATHS) {
    const path = resolve(home, relativePath);
    try {
      const metadata = await filesystem.lstat(path);
      if (!metadata.isDirectory() && !metadata.isSymbolicLink()) {
        invalidPaths.push(path);
        invalidTargets.push({ path, target: null });
        continue;
      }
      let target: string | null;
      try {
        target = await filesystem.realpath(path);
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          invalidPaths.push(path);
          invalidTargets.push({ path, target: null });
          continue;
        }
        throw error;
      }
      if (target !== expectedRoot) {
        invalidPaths.push(path);
        invalidTargets.push({ path, target });
      }
      else {
        await filesystem.readFile(resolve(target, "SKILL.md"), "utf8");
        paths.push(path);
      }
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        return {
          status: "invalid" as const,
          expectedRoot,
          paths,
          summary: `Cannot inspect personal Silvermoon skill ${path}: ${errorMessage(error)}`,
        };
      }
    }
  }
  if (invalidPaths.length > 0) {
    return {
      status: "mismatched" as const,
      expectedRoot,
      paths,
      invalidPaths,
      invalidTargets,
      remediation: `Run silvermoon-link-skill to relink the reported personal skill registration to the active global runtime's canonical skill at ${expectedRoot}, then rerun the Silvermoon command.`,
      summary: invalidTargets.map(({ path, target }) =>
        `${path} resolves to ${target ?? "an unreadable target"}; expected ${expectedRoot}.`
      ).join(" "),
    };
  }
  if (paths.length === 0) {
    return {
      status: "missing" as const,
      expectedRoot,
      paths,
      remediation: `Run silvermoon-link-skill to link the active global runtime's canonical skill at ${expectedRoot} into the personal discovery path, then rerun the Silvermoon command.`,
    };
  }
  return {
    status: "ready" as const,
    expectedRoot,
    paths,
  };
}

export { CACHE_TTL_MS, PERSONAL_SKILL_PATHS };
