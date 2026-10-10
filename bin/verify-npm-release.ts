import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { generateNpmReadme } from "./generate-npm-readme.ts";
import {
  inspectNpmTarball,
  requiredEntry,
} from "../src/foundation/package-resource/index.ts";
import {
  deriveNpmDistTag,
  parseReleaseTag,
} from "./prepare-npm-release.ts";

const npmRegistry = "https://registry.npmjs.org";
const repository = "shazhou-ww/silvermoon";
const repositoryRoot = new URL("../", import.meta.url);
const workflowPath = ".github/workflows/publish-npm.yml";
const publicMetadata = {
  license: "MIT",
  homepage: "https://github.com/shazhou-ww/silvermoon#readme",
  bugsUrl: "https://github.com/shazhou-ww/silvermoon/issues",
  repositoryType: "git",
  repositoryUrl: "git+https://github.com/shazhou-ww/silvermoon.git",
};
const publicMaintainer = {
  name: "shazhou-ww",
  url: "https://github.com/shazhou-ww",
};
const provenanceType = "https://slsa.dev/provenance/v1";
const npmPublishType =
  "https://github.com/npm/attestation/tree/main/specs/publish/v0.1";
const assetContentTypes = new Map([
  ["assets/silvermoon.svg", "image/svg+xml"],
  ["assets/silvermoon-avatar.svg", "image/svg+xml"],
  ["assets/silvermoon-mascot.png", "image/png"],
]);
const assetPaths = [...assetContentTypes.keys()];

type JsonRecord = Record<string, unknown>;
type Release = {
  packageName: string;
  version: string;
  distTag: string;
  commit: string;
  sourceRef: string;
  tarballPath: string;
};
type Retry = { attempt: number; attempts: number; error: unknown };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${description} must be an object.`);
  return value;
}

function nestedRecord(value: unknown, ...keys: string[]): JsonRecord | undefined {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return isRecord(current) ? current : undefined;
}

async function fetchResponse(
  url: string,
  description: string,
  fetchImpl: typeof fetch,
  headers: Record<string, string> = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`Could not fetch ${description}: ${errorMessage(error)}`);
  }
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${description}: server returned ${response.status}.`,
    );
  }
  return response;
}

async function fetchJson(
  url: string,
  description: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchResponse(
    url,
    description,
    fetchImpl,
    { accept: "application/json" },
  );
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Could not parse ${description}: ${errorMessage(error)}`);
  }
}

function assertTrustedRegistryUrl(value: unknown, description: string): string {
  let url: URL;
  try {
    if (typeof value !== "string") throw new TypeError("URL must be a string");
    url = new URL(value);
  } catch {
    throw new Error(`${description} is not a valid URL.`);
  }
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") {
    throw new Error(`${description} must use https://registry.npmjs.org.`);
  }
  return url.href;
}

function assertImmutableReadme(readme: string, filename: string, commit: string): void {
  let regenerated;
  try {
    regenerated = generateNpmReadme({ source: readme, commit });
  } catch (error) {
    throw new Error(`${filename} is not an immutable release README: ${errorMessage(error)}`);
  }
  if (regenerated !== readme) {
    throw new Error(`${filename} still contains references that require release rewriting.`);
  }
}

function assertPerson(value: unknown, description: string): void {
  const person = isRecord(value) ? value : {};
  if (
    person.name !== publicMaintainer.name ||
    person.url !== publicMaintainer.url
  ) {
    throw new Error(
      `${description} must identify ${publicMaintainer.name} at ${publicMaintainer.url}.`,
    );
  }
}

function assertPublicMetadata(
  manifest: unknown,
  description: string,
  { people = false }: { people?: boolean } = {},
): void {
  const metadata = requireRecord(manifest, description);
  if (metadata.license !== publicMetadata.license) {
    throw new Error(`${description} license must be ${publicMetadata.license}.`);
  }
  if (metadata.homepage !== publicMetadata.homepage) {
    throw new Error(`${description} homepage does not match the project homepage.`);
  }
  if (nestedRecord(metadata, "bugs")?.url !== publicMetadata.bugsUrl) {
    throw new Error(`${description} bugs URL does not match the issue tracker.`);
  }
  if (
    nestedRecord(metadata, "repository")?.type !== publicMetadata.repositoryType ||
    nestedRecord(metadata, "repository")?.url !== publicMetadata.repositoryUrl
  ) {
    throw new Error(`${description} repository metadata does not match the source repository.`);
  }
  if (!people) return;

  assertPerson(metadata.author, `${description} author`);
  for (const field of ["contributors", "maintainers"]) {
    const peopleValue = metadata[field];
    if (!Array.isArray(peopleValue) || peopleValue.length !== 1) {
      throw new Error(`${description} ${field} must contain one explicit maintainer.`);
    }
    assertPerson(peopleValue[0], `${description} ${field}[0]`);
  }
}

function decodeAttestation(attestation: unknown): JsonRecord {
  const record = requireRecord(attestation, "Attestation");
  const encoded = nestedRecord(record, "bundle", "dsseEnvelope")?.payload;
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error(`Attestation ${String(record.predicateType ?? "(unknown)")} has no payload.`);
  }
  try {
    const statement: unknown = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    );
    return requireRecord(
      statement,
      "Attestation statement",
    );
  } catch (error) {
    throw new Error(
      `Could not decode attestation ${String(record.predicateType)}: ${errorMessage(error)}`,
    );
  }
}

function assertAttestationSubject(
  statement: JsonRecord,
  packageName: string,
  version: string,
  sha512: string,
): void {
  const subjectName = `pkg:npm/${packageName}@${version}`;
  const matches = Array.isArray(statement.subject) && statement.subject.some((subject: unknown) => {
    const item = isRecord(subject) ? subject : {};
    return item.name === subjectName && nestedRecord(item, "digest")?.sha512 === sha512;
  });
  if (!matches) {
    throw new Error(
      `Attestation subject does not match ${subjectName} and the candidate SHA-512.`,
    );
  }
}

function verifyAttestations({
  document,
  packageName,
  version,
  sha512,
  commit,
  sourceRef,
}: {
  document: unknown;
  packageName: string;
  version: string;
  sha512: string;
  commit: string;
  sourceRef: string;
}): string {
  const documentRecord = requireRecord(document, "npm attestation response");
  if (!Array.isArray(documentRecord.attestations)) {
    throw new Error("npm attestation response does not contain attestations.");
  }
  const publishAttestation = documentRecord.attestations.find(
    (entry: unknown) => isRecord(entry) && entry.predicateType === npmPublishType,
  );
  const provenanceAttestation = documentRecord.attestations.find(
    (entry: unknown) => isRecord(entry) && entry.predicateType === provenanceType,
  );
  if (!publishAttestation || !provenanceAttestation) {
    throw new Error("npm publish and SLSA provenance attestations are both required.");
  }

  const publishStatement = decodeAttestation(publishAttestation);
  assertAttestationSubject(publishStatement, packageName, version, sha512);
  if (
    nestedRecord(publishStatement, "predicate")?.name !== packageName ||
    nestedRecord(publishStatement, "predicate")?.version !== version ||
    nestedRecord(publishStatement, "predicate")?.registry !== npmRegistry
  ) {
    throw new Error("npm publish attestation predicate does not match the release.");
  }

  const provenanceStatement = decodeAttestation(provenanceAttestation);
  assertAttestationSubject(provenanceStatement, packageName, version, sha512);
  const workflow = nestedRecord(
    provenanceStatement, "predicate", "buildDefinition", "externalParameters", "workflow",
  );
  if (
    workflow?.repository !== `https://github.com/${repository}` ||
    workflow?.path !== workflowPath ||
    workflow?.ref !== sourceRef
  ) {
    throw new Error("SLSA provenance workflow identity does not match the publication source.");
  }
  const dependencies = nestedRecord(
    provenanceStatement, "predicate", "buildDefinition",
  )?.resolvedDependencies;
  const dependency = Array.isArray(dependencies)
    ? dependencies.find((entry: unknown) =>
      isRecord(entry) && nestedRecord(entry, "digest")?.gitCommit === commit)
    : undefined;
  if (
    (!isRecord(dependency) || dependency.uri !==
    `git+https://github.com/${repository}@${sourceRef}`
    )
  ) {
    throw new Error("SLSA provenance does not resolve the expected release commit.");
  }
  const builder = nestedRecord(provenanceStatement, "predicate", "runDetails", "builder")?.id;
  const invocationId =
    nestedRecord(provenanceStatement, "predicate", "runDetails", "metadata")?.invocationId;
  if (
    builder !== "https://github.com/actions/runner/github-hosted" ||
    typeof invocationId !== "string" ||
    !invocationId.startsWith(
      `https://github.com/${repository}/actions/runs/`,
    )
  ) {
    throw new Error("SLSA provenance builder identity is not the trusted workflow.");
  }
  return invocationId;
}

export function validatePublicationSource({
  distTag,
  sourceRef,
  version,
}: Pick<Release, "distTag" | "sourceRef" | "version">): void {
  if (!sourceRef.startsWith("refs/tags/")) {
    throw new Error("npm publication source must be an immutable release tag.");
  }
  const tag = sourceRef.slice("refs/tags/".length);
  const parsedTag = parseReleaseTag(tag);
  if (parsedTag.version !== version) {
    throw new Error(`Release tag ${tag} does not select version ${version}.`);
  }
  if (deriveNpmDistTag(version) !== distTag) {
    throw new Error(`Release version ${version} does not select npm dist-tag ${distTag}.`);
  }
}

export async function verifyNpmRelease(
  { packageName, version, distTag, commit, sourceRef, tarballPath }: Release,
  { fetchImpl = globalThis.fetch }: { fetchImpl?: typeof fetch } = {},
) {
  if (!/^[0-9a-f]{40,64}$/i.test(commit ?? "")) {
    throw new Error("Release commit must be a full hexadecimal Git object ID.");
  }
  validatePublicationSource({ distTag, sourceRef, version });
  for (const [name, value] of Object.entries({ packageName, version, distTag })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${name} is required for release verification.`);
    }
  }

  const candidate = await inspectNpmTarball(tarballPath);
  if (
    candidate.manifest.name !== packageName ||
    candidate.manifest.version !== version
  ) {
    throw new Error(
      `Candidate tarball identity mismatch: expected ${packageName}@${version}, found ${candidate.manifest.name ?? "missing"}@${candidate.manifest.version ?? "missing"}.`,
    );
  }
  if (candidate.manifest.gitHead !== commit) {
    throw new Error(
      `Candidate tarball gitHead mismatch: expected ${commit}, found ${candidate.manifest.gitHead ?? "missing"}.`,
    );
  }
  assertPublicMetadata(candidate.manifest, "Candidate tarball", {
    people: true,
  });
  const readmes = new Map<string, string>();
  for (const filename of ["README.md", "README.zh-CN.md"]) {
    const entry = requiredEntry(candidate.entries, filename);
    if (!(entry instanceof Uint8Array)) {
      throw new Error(`Candidate tarball ${filename} is not binary file content.`);
    }
    const readme = Buffer.from(entry).toString("utf8");
    assertImmutableReadme(readme, filename, commit);
    readmes.set(filename.toLowerCase(), readme);
  }
  const candidateReadmeFilename = candidate.manifest.readmeFilename;
  const candidatePackageReadme =
    typeof candidateReadmeFilename === "string"
      ? readmes.get(candidateReadmeFilename.toLowerCase())
      : undefined;
  if (
    !candidatePackageReadme ||
    candidate.manifest.readme !== candidatePackageReadme
  ) {
    throw new Error(
      `Candidate tarball package README metadata does not match ${candidateReadmeFilename ?? "(missing filename)"}.`,
    );
  }

  const encodedPackage = encodeURIComponent(packageName);
  const packageUrl = `${npmRegistry}/${encodedPackage}`;
  const versionUrl = `${packageUrl}/${encodeURIComponent(version)}`;
  const [packageMetadataValue, versionMetadataValue] = await Promise.all([
    fetchJson(packageUrl, `${packageName} metadata`, fetchImpl),
    fetchJson(versionUrl, `${packageName}@${version} metadata`, fetchImpl),
  ]);
  const packageMetadata = requireRecord(packageMetadataValue, "npm package metadata");
  const versionMetadata = requireRecord(versionMetadataValue, "npm version metadata");
  if (versionMetadata.name !== packageName || versionMetadata.version !== version) {
    throw new Error(`npm version metadata does not identify ${packageName}@${version}.`);
  }
  if (nestedRecord(packageMetadata, "dist-tags")?.[distTag] !== version) {
    throw new Error(
      `npm dist-tag ${distTag} does not point to ${version}.`,
    );
  }
  const versions = nestedRecord(packageMetadata, "versions");
  if (!versions || !Object.hasOwn(versions, version)) {
    throw new Error(`npm package metadata does not contain version ${version}.`);
  }
  if (versionMetadata.gitHead !== commit) {
    throw new Error(
      `npm gitHead mismatch: expected ${commit}, found ${versionMetadata.gitHead ?? "missing"}.`,
    );
  }
  assertPublicMetadata(versionMetadata, "npm version metadata");
  const dist = nestedRecord(versionMetadata, "dist");
  if (
    dist?.integrity !== candidate.integrity ||
    dist?.shasum !== candidate.shasum ||
    dist?.fileCount !== candidate.fileCount
  ) {
    throw new Error("npm dist identity does not match the verified candidate tarball.");
  }
  const registryVersion = versions[version];
  assertPublicMetadata(registryVersion, "npm package version metadata");
  if (
    nestedRecord(registryVersion, "dist")?.integrity !== candidate.integrity ||
    nestedRecord(registryVersion, "dist")?.shasum !== candidate.shasum
  ) {
    throw new Error("npm package metadata disagrees with exact version metadata.");
  }

  if (
    distTag === "latest" &&
    (
      packageMetadata.readmeFilename !== candidateReadmeFilename ||
      packageMetadata.readme !== candidatePackageReadme
    )
  ) {
    throw new Error(
      `npm package README does not match candidate ${candidateReadmeFilename}.`,
    );
  }

  const tarballUrl = assertTrustedRegistryUrl(
    dist?.tarball,
    "npm tarball URL",
  );
  const attestationUrl = assertTrustedRegistryUrl(
    nestedRecord(dist, "attestations")?.url,
    "npm attestation URL",
  );
  if (nestedRecord(dist, "attestations", "provenance")?.predicateType !== provenanceType) {
    throw new Error("npm version metadata does not advertise SLSA provenance.");
  }

  const [tarballResponse, attestationDocument, ...assetResponses] =
    await Promise.all([
      fetchResponse(tarballUrl, "published npm tarball", fetchImpl),
      fetchJson(attestationUrl, "npm attestations", fetchImpl),
      ...assetPaths.map((path) =>
        fetchResponse(
          `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
          `jsDelivr asset ${path}`,
          fetchImpl,
        )
      ),
    ]);
  const registryTarball = Buffer.from(await tarballResponse.arrayBuffer());
  if (!registryTarball.equals(candidate.bytes)) {
    throw new Error("Published npm tarball bytes do not match the verified candidate.");
  }

  const sourceAssets = await Promise.all(
    assetPaths.map(async (path) => {
      try {
        return await readFile(new URL(path, repositoryRoot));
      } catch (error: unknown) {
        throw new Error(`Could not read release checkout asset ${path}: ${errorMessage(error)}`);
      }
    }),
  );
  for (let index = 0; index < assetPaths.length; index += 1) {
    const path = assetPaths[index];
    const response = assetResponses[index];
    const sourceAsset = sourceAssets[index];
    if (!path || !response || !sourceAsset) {
      throw new Error("Release asset responses are incomplete.");
    }
    const contentType = response.headers.get("content-type") ?? "";
    const expectedContentType = assetContentTypes.get(path);
    if (!expectedContentType || !contentType.toLowerCase().includes(expectedContentType)) {
      throw new Error(
        `jsDelivr asset ${path} did not return ${expectedContentType} content.`,
      );
    }
    const publishedAsset = Buffer.from(await response.arrayBuffer());
    if (!publishedAsset.equals(sourceAsset)) {
      throw new Error(`jsDelivr asset ${path} does not match the release checkout.`);
    }
  }

  const invocationId = verifyAttestations({
    document: attestationDocument,
    packageName,
    version,
    sha512: candidate.sha512,
    commit,
    sourceRef,
  });
  return {
    packageName,
    version,
    distTag,
    commit,
    tarballPath: candidate.tarballPath,
    sha256: candidate.sha256,
    integrity: candidate.integrity,
    fileCount: candidate.fileCount,
    license: publicMetadata.license,
    homepage: publicMetadata.homepage,
    bugsUrl: publicMetadata.bugsUrl,
    readmeFilename: candidateReadmeFilename,
    provenanceInvocation: invocationId,
    assets: assetPaths.map(
      (path) => `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
    ),
  };
}

export async function verifyNpmReleaseEventually(
  release: Release,
  {
    attempts = 30,
    delayMs = 10_000,
    fetchImpl = globalThis.fetch,
    sleepImpl = (duration: number) =>
      new Promise<void>((resolveDelay) => setTimeout(resolveDelay, duration)),
    onRetry = (_retry: Retry) => {},
  }: {
    attempts?: number;
    delayMs?: number;
    fetchImpl?: typeof fetch;
    sleepImpl?: (duration: number) => Promise<unknown>;
    onRetry?: (retry: Retry) => unknown;
  } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("Verification attempts must be a positive integer.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error("Verification delay must be a non-negative integer.");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await verifyNpmRelease(release, { fetchImpl });
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      onRetry({ attempt, attempts, error });
      await sleepImpl(delayMs);
    }
  }
  throw new Error(
    `Published release verification failed after ${attempts} attempts: ${errorMessage(lastError)}`,
  );
}

function parseArguments(argv: readonly string[]): Release {
  const names = new Map<string, keyof Release>([
    ["--package-name", "packageName"],
    ["--version", "version"],
    ["--dist-tag", "distTag"],
    ["--commit", "commit"],
    ["--source-ref", "sourceRef"],
    ["--tarball", "tarballPath"],
  ]);
  const values: Partial<Release> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    const name = option === undefined ? undefined : names.get(option);
    if (!name || !value) {
      throw new Error(
        "Usage: node bin/verify-npm-release.ts --package-name <name> --version <version> --dist-tag <tag> --commit <sha> --source-ref <git-ref> --tarball <path>",
      );
    }
    values[name] = value;
  }
  const { packageName, version, distTag, commit, sourceRef, tarballPath } = values;
  if (!packageName || !version || !distTag || !commit || !sourceRef || !tarballPath) {
    throw new Error(
      "Usage: node bin/verify-npm-release.ts --package-name <name> --version <version> --dist-tag <tag> --commit <sha> --source-ref <git-ref> --tarball <path>",
    );
  }
  return {
    packageName,
    version,
    distTag,
    commit,
    sourceRef,
    tarballPath,
  };
}

async function main() {
  const release = parseArguments(process.argv.slice(2));
  const result = await verifyNpmReleaseEventually(release, {
    onRetry({ attempt, attempts, error }: Retry) {
      process.stderr.write(
        `VERIFY_RETRY attempt=${attempt}/${attempts} reason=${errorMessage(error)}\n`,
      );
    },
  });
  process.stdout.write(`VERIFY_NPM_RELEASE_OK ${JSON.stringify(result)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
