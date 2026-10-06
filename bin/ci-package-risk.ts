import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";
import { appendFileSync } from "node:fs";
import { isMain } from "./run-checks.ts";

type Risk = { required: boolean; reason: string };
type RiskOptions = { base?: string; head?: string; full?: boolean };
type ObserveOptions = RiskOptions & {
  cwd?: string;
  spawnImpl?: (
    command: string,
    args: readonly string[],
    options: SpawnSyncOptionsWithStringEncoding,
  ) => SpawnSyncReturns<string>;
};

export function packageRisk(paths: unknown): Risk {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { required: true, reason: "No trustworthy changed-path set; running package checks" };
  }
  const riskyIndex = paths.findIndex((path) =>
    typeof path !== "string"
    || !/^\.silvermoon\/ideas\/[0-9A-HJKMNP-TV-Z]{26}\/[^\\]+$/.test(path)
    || path.split("/").some((part) => part === "." || part === ".." || part === "")
  );
  if (riskyIndex !== -1) {
    return { required: true, reason: `Package, infrastructure, or unknown path: ${String(paths[riskyIndex])}` };
  }
  return { required: false, reason: "Only repository-owned idea metadata changed" };
}

export function parseRiskArgs(args: readonly string[]): RiskOptions {
  const options: RiskOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--full" && !options.full) {
      options.full = true;
    } else if ((key === "--base" || key === "--head")
      && !Object.hasOwn(options, key.slice(2))) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("Usage: node bin/ci-package-risk.mjs [--base SHA] [--head SHA] [--full]");
      }
      index += 1;
      if (key === "--base") options.base = value;
      else options.head = value;
    } else {
      throw new Error("Usage: node bin/ci-package-risk.mjs [--base SHA] [--head SHA] [--full]");
    }
  }
  return options;
}

export function observePackageRisk({
  base,
  head = "HEAD",
  full = false,
  cwd = process.cwd(),
  spawnImpl = spawnSync,
}: ObserveOptions = {}): Risk {
  if (full) return { required: true, reason: "Explicit full validation" };
  if (!/^[a-f0-9]{40,64}$/i.test(base ?? "") || /^0+$/.test(base ?? "")
    || !(head === "HEAD" || /^[a-f0-9]{40,64}$/i.test(head))) {
    return { required: true, reason: "Missing or invalid baseline/head; running package checks" };
  }
  if (base === undefined) {
    return { required: true, reason: "Missing or invalid baseline/head; running package checks" };
  }
  const result = spawnImpl("git", ["diff", "--no-renames", "--name-only", "-z", base, head, "--"], {
    cwd, encoding: "utf8", windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return {
      required: true,
      reason: `Baseline unavailable; running package checks: ${result.error?.message ?? result.stderr?.trim() ?? `exit ${result.status}`}`,
    };
  }
  if (!result.stdout || !result.stdout.endsWith("\0")) {
    return { required: true, reason: "Empty or malformed diff; running package checks" };
  }
  return packageRisk(result.stdout.slice(0, -1).split("\0"));
}

if (isMain(import.meta.url)) {
  try {
    const result = observePackageRisk(parseRiskArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `required=${result.required}\n`);
    }
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
