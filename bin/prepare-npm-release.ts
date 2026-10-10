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
type CanaryPlan = ReleasePlan & { baseVersion: string };
type PublicationState = "absent" | "published" | "unchanged";
type PreparedPlan = (ReleasePlan | CanaryPlan) & {
  publicationState: PublicationState;
};
type PrepareCanaryOptions = {
  commit: string;
  fetchImpl?: typeof fetch;
  root?: string;
  runNumber: string;
};

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

export function createCanaryVersion({
  baseVersion,
  commit,
  runNumber,
}: {
  baseVersion: string;
  commit: string;
  runNumber: string;
}): string {
  const canonicalBase = semver.valid(baseVersion);
  if (
    canonicalBase !== baseVersion ||
    semver.prerelease(baseVersion) !== null ||
    (semver.parse(baseVersion)?.build.length ?? 0) > 0
  ) {
    throw new Error(`Canary base version must be stable canonical SemVer: ${baseVersion}`);
  }
  const releaseCommit = validateCommit(commit).toLowerCase();
  if (!/^[1-9]\d*$/.test(runNumber)) {
    throw new Error("Canary run number must be a positive canonical integer.");
  }
  return validateCanaryVersionForBase({
    baseVersion,
    commit: releaseCommit,
    version: `${baseVersion}-canary.${runNumber}.g${releaseCommit.slice(0, 12)}`,
  });
}

export function validateCanaryVersionForBase({
  baseVersion,
  commit,
  version,
}: {
  baseVersion: string;
  commit?: string;
  version: string;
}): string {
  const base = semver.parse(baseVersion);
  const candidate = semver.parse(version);
  const prerelease = candidate?.prerelease ?? [];
  const expectedCommit = commit === undefined
    ? null
    : `g${validateCommit(commit).toLowerCase().slice(0, 12)}`;
  if (
    semver.valid(baseVersion) !== baseVersion ||
    !base ||
    base.prerelease.length > 0 ||
    base.build.length > 0 ||
    semver.valid(version) !== version ||
    !candidate ||
    candidate.major !== base.major ||
    candidate.minor !== base.minor ||
    candidate.patch !== base.patch ||
    prerelease.length !== 3 ||
    prerelease[0] !== "canary" ||
    typeof prerelease[1] !== "number" ||
    typeof prerelease[2] !== "string" ||
    !/^g[0-9a-f]{12}$/.test(prerelease[2]) ||
    (expectedCommit !== null && prerelease[2] !== expectedCommit)
  ) {
    throw new Error(
      `Canary version ${version} must extend ${baseVersion} as canary.<run-number>.g<12-hex-commit>.`,
    );
  }
  return version;
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

export function createCanaryPlan({
  commit,
  manifest,
  primaryCommit,
  runNumber,
}: {
  commit: string;
  manifest: unknown;
  primaryCommit: string;
  runNumber: string;
}): CanaryPlan {
  const releaseCommit = validateCommit(commit);
  const currentPrimaryCommit = validateCommit(primaryCommit);
  if (releaseCommit !== currentPrimaryCommit) {
    throw new Error(
      `Canary commit ${releaseCommit} must equal refreshed origin/main ${currentPrimaryCommit}.`,
    );
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Package manifest is invalid: ./package.json");
  }
  const baseVersion = Reflect.get(manifest, "version");
  if (typeof baseVersion !== "string") {
    throw new Error("Canary package manifest must declare a version.");
  }
  const version = createCanaryVersion({
    baseVersion,
    commit: releaseCommit,
    runNumber,
  });
  const plan = createReleasePlan({
    commit: releaseCommit,
    manifest: { ...manifest, version },
    reachableFromPrimary: true,
    tag: `npm/silvermoon/v${version}`,
  });
  return { ...plan, baseVersion };
}

export function createTaggedCanaryPlan({
  commit,
  manifest,
  reachableFromPrimary,
  tag,
}: {
  commit: string;
  manifest: unknown;
  reachableFromPrimary: boolean;
  tag: string;
}): CanaryPlan {
  const parsed = parseReleaseTag(tag);
  if (parsed.releaseKey !== "silvermoon" || deriveNpmDistTag(parsed.version) !== "canary") {
    throw new Error("Tagged canary must use npm/silvermoon/v<canary-version>.");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Package manifest is invalid: ./package.json");
  }
  const baseVersion = Reflect.get(manifest, "version");
  if (typeof baseVersion !== "string") {
    throw new Error("Canary package manifest must declare a version.");
  }
  validateCanaryVersionForBase({
    baseVersion,
    commit,
    version: parsed.version,
  });
  const plan = createReleasePlan({
    commit,
    manifest: { ...manifest, version: parsed.version },
    reachableFromPrimary,
    tag,
  });
  return { ...plan, baseVersion };
}

async function fetchPackageMetadata(
  packageName: string,
  version: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetchImpl(`${npmRegistry}/${encodeURIComponent(packageName)}`, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`Could not verify ${packageName}@${version} on npm: ${errorMessage(error)}`);
  }

  if (response.status === 404) return null;
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
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`npm metadata for ${packageName} must be an object.`);
  }
  return metadata as Record<string, unknown>;
}

export async function observeVersionPublication(
  { packageName, version }: Pick<ReleasePlan, "packageName" | "version">,
  { fetchImpl = globalThis.fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<"absent" | "published"> {
  const metadata = await fetchPackageMetadata(packageName, version, fetchImpl);
  if (metadata === null) return "absent";
  const versions = Reflect.get(metadata, "versions");
  if (!versions || typeof versions !== "object") {
    throw new Error(`npm metadata for ${packageName} does not contain a versions object.`);
  }
  return Object.hasOwn(versions, version) ? "published" : "absent";
}

export async function observeCanaryPublication(
  {
    baseVersion,
    commit,
    packageName,
    version,
  }: Pick<CanaryPlan, "baseVersion" | "commit" | "packageName" | "version">,
  {
    fetchImpl = globalThis.fetch,
    skipUnchanged = true,
  }: {
    fetchImpl?: typeof fetch;
    skipUnchanged?: boolean;
  } = {},
): Promise<PublicationState> {
  const metadata = await fetchPackageMetadata(packageName, version, fetchImpl);
  if (metadata === null) return "absent";
  const versions = Reflect.get(metadata, "versions");
  if (!versions || typeof versions !== "object") {
    throw new Error(`npm metadata for ${packageName} does not contain a versions object.`);
  }
  if (Object.hasOwn(versions, version)) return "published";
  if (Object.hasOwn(versions, baseVersion)) {
    throw new Error(
      `Canary base ${packageName}@${baseVersion} is already published; advance the manifest before publishing another canary.`,
    );
  }
  if (!skipUnchanged) return "absent";

  const distTags = Reflect.get(metadata, "dist-tags");
  const currentCanary = distTags && typeof distTags === "object"
    ? Reflect.get(distTags, "canary")
    : undefined;
  if (typeof currentCanary !== "string") return "absent";
  const currentMetadata = Reflect.get(versions, currentCanary);
  return currentMetadata && typeof currentMetadata === "object"
      && Reflect.get(currentMetadata, "gitHead") === commit
    ? "unchanged"
    : "absent";
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

export function resolvePrimaryCommit(
  { root = repositoryRoot }: { root?: string } = {},
): string {
  const result = spawnSync("git", ["rev-parse", "refs/remotes/origin/main"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not resolve origin/main: ${result.stderr || result.error?.message || "git failed"}`,
    );
  }
  return validateCommit(result.stdout.trim());
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

function parseArguments(argv: readonly string[]):
  | { channel: "canary"; commit: string; runNumber: string }
  | { channel: "release"; commit: string; tag: string } {
  const values: {
    channel?: string;
    commit?: string;
    runNumber?: string;
    tag?: string;
  } = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (
      !option ||
      !value ||
      !["--channel", "--commit", "--run-number", "--tag"].includes(option)
    ) {
      throw new Error(
        "Usage: node bin/prepare-npm-release.ts (--tag <tag> | --channel canary --run-number <number>) --commit <sha>",
      );
    }
    if (option === "--commit") values.commit = value;
    else if (option === "--tag") values.tag = value;
    else if (option === "--channel") values.channel = value;
    else values.runNumber = value;
  }
  if (!values.commit) {
    throw new Error(
      "Usage: node bin/prepare-npm-release.ts (--tag <tag> | --channel canary --run-number <number>) --commit <sha>",
    );
  }
  if (values.tag && values.channel === undefined && values.runNumber === undefined) {
    return { channel: "release", commit: values.commit, tag: values.tag };
  }
  if (
    values.tag === undefined &&
    values.channel === "canary" &&
    values.runNumber
  ) {
    return {
      channel: "canary",
      commit: values.commit,
      runNumber: values.runNumber,
    };
  }
  throw new Error(
    "Usage: node bin/prepare-npm-release.ts (--tag <tag> | --channel canary --run-number <number>) --commit <sha>",
  );
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
  const reachableFromPrimary = isReachableFromPrimary(commit, { root });
  const canary = deriveNpmDistTag(parsed.version) === "canary";
  const plan = canary
    ? createTaggedCanaryPlan({
      commit,
      manifest,
      reachableFromPrimary,
      tag,
    })
    : createReleasePlan({
      commit,
      manifest,
      reachableFromPrimary,
      tag,
    });
  const publicationState = canary
    ? await observeCanaryPublication(plan as CanaryPlan, {
      ...(fetchImpl === undefined ? {} : { fetchImpl }),
      skipUnchanged: false,
    })
    : await observeVersionPublication(
      plan,
      fetchImpl === undefined ? {} : { fetchImpl },
    );
  return { ...plan, publicationState };
}

export async function prepareNpmCanary({
  commit,
  fetchImpl,
  root = repositoryRoot,
  runNumber,
}: PrepareCanaryOptions): Promise<PreparedPlan> {
  const release = RELEASE_PACKAGES.silvermoon;
  const manifestPath = resolve(root, release.directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const plan = createCanaryPlan({
    commit,
    manifest,
    primaryCommit: resolvePrimaryCommit({ root }),
    runNumber,
  });
  const publicationState = await observeCanaryPublication(
    plan,
    fetchImpl === undefined ? {} : { fetchImpl },
  );
  return { ...plan, publicationState };
}

async function main() {
  const request = parseArguments(process.argv.slice(2));
  const plan = request.channel === "canary"
    ? await prepareNpmCanary(request)
    : await prepareNpmRelease(request);
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