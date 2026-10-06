import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import semver from "semver";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const npmRegistry = "https://registry.npmjs.org";

export const RELEASE_PACKAGES = Object.freeze({
  silvermoon: Object.freeze({
    directory: ".",
    packageName: "silvermoon",
  }),
});

type ReleaseKey = keyof typeof RELEASE_PACKAGES;
type ReleasePlan = {
  commit: string;
  distTag: string;
  packageDirectory: string;
  packageName: string;
  releaseKey: ReleaseKey;
  version: string;
};
type PrepareOptions = {
  commit: string;
  fetchImpl?: typeof fetch;
  root?: string;
  tag: string;
};
type PreparedPlan = ReleasePlan & { publicationState: "absent" | "published" };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isReleaseKey(value: string): value is ReleaseKey {
  return value === "silvermoon";
}

function validateCommit(commit: unknown): string {
  if (typeof commit !== "string" || !/^[0-9a-f]{40,64}$/i.test(commit)) {
    throw new Error("Release commit must be a full hexadecimal Git object ID.");
  }
  return commit;
}

export function parseReleaseTag(tag: unknown): { releaseKey: string; version: string } {
  const match = typeof tag === "string"
    ? /^npm\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\/v(.+)$/.exec(tag)
    : null;
  if (!match) {
    throw new Error("Release tag must match npm/<release-key>/v<semver>.");
  }

  const [, releaseKey, requestedVersion] = match;
  if (!releaseKey || !requestedVersion) {
    throw new Error("Release tag must match npm/<release-key>/v<semver>.");
  }
  const version = semver.valid(requestedVersion);
  if (!version || version !== requestedVersion) {
    throw new Error(`Release tag version is not canonical SemVer: ${requestedVersion}`);
  }
  return { releaseKey, version };
}

export function deriveNpmDistTag(version: string): string {
  const prerelease = semver.prerelease(version);
  if (!prerelease) return "latest";

  const channel = prerelease[0];
  if (typeof channel !== "string" || !/^[a-z][a-z0-9-]*$/i.test(channel)) {
    throw new Error(
      `Prerelease ${version} must begin with a named channel such as alpha, beta, or rc.`,
    );
  }
  if (channel.toLowerCase() === "latest") {
    throw new Error("Prerelease channel must not use the latest npm dist-tag.");
  }
  return channel.toLowerCase();
}

export function createReleasePlan({
  commit,
  manifest,
  reachableFromPrimary,
  releases = RELEASE_PACKAGES,
  tag,
}: {
  commit: string;
  manifest: unknown;
  reachableFromPrimary: boolean;
  releases?: typeof RELEASE_PACKAGES;
  tag: string;
}): ReleasePlan {
  const { releaseKey, version } = parseReleaseTag(tag);
  if (!isReleaseKey(releaseKey)) {
    throw new Error(`Unknown npm release key: ${releaseKey}`);
  }
  const release = releases[releaseKey];
  if (!release) {
    throw new Error(`Unknown npm release key: ${releaseKey}`);
  }
  validateCommit(commit);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Package manifest is invalid: ${release.directory}/package.json`);
  }
  const manifestName = Reflect.get(manifest, "name");
  const manifestPrivate = Reflect.get(manifest, "private");
  const manifestVersion = Reflect.get(manifest, "version");
  const publishConfig = Reflect.get(manifest, "publishConfig");
  const publishConfigRecord = typeof publishConfig === "object" && publishConfig !== null
    ? publishConfig : undefined;
  if (manifestName !== release.packageName) {
    throw new Error(
      `Package name mismatch for ${releaseKey}: expected ${release.packageName}, found ${String(manifestName ?? "missing")}.`,
    );
  }
  if (manifestPrivate === true) {
    throw new Error(`Package ${String(manifestName)} is private and cannot be published.`);
  }
  if (manifestVersion !== version) {
    throw new Error(
      `Version mismatch for ${String(manifestName)}: tag requests ${version}, manifest has ${String(manifestVersion ?? "missing")}.`,
    );
  }
  const registryValue = publishConfigRecord
    ? Reflect.get(publishConfigRecord, "registry") : undefined;
  const registry = typeof registryValue === "string"
    ? registryValue.replace(/\/$/, "") : undefined;
  if (registry !== npmRegistry) {
    throw new Error(`Package ${String(manifestName)} must publish to ${npmRegistry}.`);
  }
  if (!publishConfigRecord || Reflect.get(publishConfigRecord, "access") !== "public") {
    throw new Error(`Package ${String(manifestName)} must set publishConfig.access to public.`);
  }
  if (reachableFromPrimary !== true) {
    throw new Error(`Release commit ${commit} is not reachable from origin/main.`);
  }

  return {
    commit,
    distTag: deriveNpmDistTag(version),
    packageDirectory: release.directory,
    packageName: release.packageName,
    releaseKey,
    version,
  };
}

export async function observeVersionPublication(
  { packageName, version }: Pick<ReleasePlan, "packageName" | "version">,
  { fetchImpl = globalThis.fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<"absent" | "published"> {
  let response: Response;
  try {
    response = await fetchImpl(`${npmRegistry}/${encodeURIComponent(packageName)}`, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`Could not verify ${packageName}@${version} on npm: ${errorMessage(error)}`);
  }

  if (response.status === 404) return "absent";
  if (!response.ok) {
    throw new Error(
      `Could not verify ${packageName}@${version} on npm: registry returned ${response.status}.`,
    );
  }

  let metadata: unknown;
  try {
    metadata = await response.json();
  } catch (error) {
    throw new Error(`Could not parse npm metadata for ${packageName}: ${errorMessage(error)}`);
  }
  const versions = typeof metadata === "object" && metadata !== null
    ? Reflect.get(metadata, "versions") : undefined;
  if (!versions || typeof versions !== "object") {
    throw new Error(`npm metadata for ${packageName} does not contain a versions object.`);
  }
  return Object.hasOwn(versions, version) ? "published" : "absent";
}

export function isReachableFromPrimary(
  commit: string,
  { root = repositoryRoot }: { root?: string } = {},
): boolean {
  validateCommit(commit);
  const result = spawnSync("git", ["merge-base", "--is-ancestor", commit, "origin/main"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(
    `Could not verify origin/main reachability: ${result.stderr || result.error?.message || "git failed"}`,
  );
}

export function formatGitHubOutput(plan: PreparedPlan): string {
  return [
    `release_key=${plan.releaseKey}`,
    `package_name=${plan.packageName}`,
    `package_directory=${plan.packageDirectory}`,
    `version=${plan.version}`,
    `dist_tag=${plan.distTag}`,
    `publication_state=${plan.publicationState}`,
  ].join("\n");
}

function parseArguments(argv: readonly string[]): { commit: string; tag: string } {
  const values: { commit?: string; tag?: string } = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option || !value || !["--commit", "--tag"].includes(option)) {
      throw new Error("Usage: node bin/prepare-npm-release.mjs --tag <tag> --commit <sha>");
    }
    if (option === "--commit") values.commit = value;
    else values.tag = value;
  }
  if (!values.commit || !values.tag) {
    throw new Error("Usage: node bin/prepare-npm-release.mjs --tag <tag> --commit <sha>");
  }
  return { commit: values.commit, tag: values.tag };
}

export async function prepareNpmRelease({
  commit, fetchImpl, root = repositoryRoot, tag,
}: PrepareOptions): Promise<PreparedPlan> {
  const parsed = parseReleaseTag(tag);
  if (!isReleaseKey(parsed.releaseKey)) {
    throw new Error(`Unknown npm release key: ${parsed.releaseKey}`);
  }
  const release = RELEASE_PACKAGES[parsed.releaseKey];

  const manifestPath = resolve(root, release.directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const plan = createReleasePlan({
    commit,
    manifest,
    reachableFromPrimary: isReachableFromPrimary(commit, { root }),
    tag,
  });
  const publicationState = await observeVersionPublication(
    plan,
    fetchImpl === undefined ? {} : { fetchImpl },
  );
  return { ...plan, publicationState };
}

async function main() {
  const { commit, tag } = parseArguments(process.argv.slice(2));
  const plan = await prepareNpmRelease({ commit, tag });
  const output = formatGitHubOutput(plan);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`Release validation failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}