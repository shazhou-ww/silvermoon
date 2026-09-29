import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { generateNpmReadme } from "./generate-npm-readme.mjs";
import {
  inspectNpmTarball,
  requiredEntry,
} from "./npm-tarball.mjs";
import { parseReleaseTag } from "./prepare-npm-release.mjs";

const npmRegistry = "https://registry.npmjs.org";
const repository = "shazhou-ww/silvermoon";
const workflowPath = ".github/workflows/publish-npm.yml";
const provenanceType = "https://slsa.dev/provenance/v1";
const npmPublishType =
  "https://github.com/npm/attestation/tree/main/specs/publish/v0.1";
const assetPaths = [
  "assets/silvermoon.svg",
  "assets/silvermoon-avatar.svg",
  "assets/silvermoon-mascot.png",
];

async function fetchResponse(url, description, fetchImpl, headers = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`Could not fetch ${description}: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${description}: server returned ${response.status}.`,
    );
  }
  return response;
}

async function fetchJson(url, description, fetchImpl) {
  const response = await fetchResponse(
    url,
    description,
    fetchImpl,
    { accept: "application/json" },
  );
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Could not parse ${description}: ${error.message}`);
  }
}

function assertTrustedRegistryUrl(value, description) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${description} is not a valid URL.`);
  }
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") {
    throw new Error(`${description} must use https://registry.npmjs.org.`);
  }
  return url.href;
}

function assertImmutableReadme(readme, filename, commit) {
  let regenerated;
  try {
    regenerated = generateNpmReadme({ source: readme, commit });
  } catch (error) {
    throw new Error(`${filename} is not an immutable release README: ${error.message}`);
  }
  if (regenerated !== readme) {
    throw new Error(`${filename} still contains references that require release rewriting.`);
  }
  for (const assetPath of assetPaths) {
    const expected =
      `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${assetPath}`;
    if (!readme.includes(expected)) {
      throw new Error(`${filename} is missing immutable asset URL ${expected}.`);
    }
  }
}

function decodeAttestation(attestation) {
  const encoded = attestation?.bundle?.dsseEnvelope?.payload;
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error(`Attestation ${attestation?.predicateType ?? "(unknown)"} has no payload.`);
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(
      `Could not decode attestation ${attestation.predicateType}: ${error.message}`,
    );
  }
}

function assertAttestationSubject(statement, packageName, version, sha512) {
  const subjectName = `pkg:npm/${packageName}@${version}`;
  const matches = statement.subject?.some(
    ({ name, digest: subjectDigest }) =>
      name === subjectName && subjectDigest?.sha512 === sha512,
  );
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
  tag,
}) {
  if (!Array.isArray(document?.attestations)) {
    throw new Error("npm attestation response does not contain attestations.");
  }
  const publishAttestation = document.attestations.find(
    ({ predicateType }) => predicateType === npmPublishType,
  );
  const provenanceAttestation = document.attestations.find(
    ({ predicateType }) => predicateType === provenanceType,
  );
  if (!publishAttestation || !provenanceAttestation) {
    throw new Error("npm publish and SLSA provenance attestations are both required.");
  }

  const publishStatement = decodeAttestation(publishAttestation);
  assertAttestationSubject(publishStatement, packageName, version, sha512);
  if (
    publishStatement.predicate?.name !== packageName ||
    publishStatement.predicate?.version !== version ||
    publishStatement.predicate?.registry !== npmRegistry
  ) {
    throw new Error("npm publish attestation predicate does not match the release.");
  }

  const provenanceStatement = decodeAttestation(provenanceAttestation);
  assertAttestationSubject(provenanceStatement, packageName, version, sha512);
  const workflow =
    provenanceStatement.predicate?.buildDefinition?.externalParameters?.workflow;
  const expectedRef = `refs/tags/${tag}`;
  if (
    workflow?.repository !== `https://github.com/${repository}` ||
    workflow?.path !== workflowPath ||
    workflow?.ref !== expectedRef
  ) {
    throw new Error("SLSA provenance workflow identity does not match the release tag.");
  }
  const dependency =
    provenanceStatement.predicate?.buildDefinition?.resolvedDependencies?.find(
      ({ digest: dependencyDigest }) => dependencyDigest?.gitCommit === commit,
    );
  if (
    dependency?.uri !==
    `git+https://github.com/${repository}@${expectedRef}`
  ) {
    throw new Error("SLSA provenance does not resolve the expected release commit.");
  }
  const builder = provenanceStatement.predicate?.runDetails?.builder?.id;
  const invocationId =
    provenanceStatement.predicate?.runDetails?.metadata?.invocationId;
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

export async function verifyNpmRelease(
  { packageName, version, distTag, commit, tag, tarballPath },
  { fetchImpl = globalThis.fetch } = {},
) {
  if (!/^[0-9a-f]{40,64}$/i.test(commit ?? "")) {
    throw new Error("Release commit must be a full hexadecimal Git object ID.");
  }
  const parsedTag = parseReleaseTag(tag);
  if (parsedTag.version !== version) {
    throw new Error(`Release tag ${tag} does not select version ${version}.`);
  }
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
  const readmes = new Map();
  for (const filename of ["README.md", "README.zh-CN.md"]) {
    const readme = requiredEntry(candidate.entries, filename).toString("utf8");
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
  const [packageMetadata, versionMetadata] = await Promise.all([
    fetchJson(packageUrl, `${packageName} metadata`, fetchImpl),
    fetchJson(versionUrl, `${packageName}@${version} metadata`, fetchImpl),
  ]);
  if (versionMetadata.name !== packageName || versionMetadata.version !== version) {
    throw new Error(`npm version metadata does not identify ${packageName}@${version}.`);
  }
  if (packageMetadata?.["dist-tags"]?.[distTag] !== version) {
    throw new Error(
      `npm dist-tag ${distTag} does not point to ${version}.`,
    );
  }
  if (!Object.hasOwn(packageMetadata?.versions ?? {}, version)) {
    throw new Error(`npm package metadata does not contain version ${version}.`);
  }
  if (versionMetadata.gitHead !== commit) {
    throw new Error(
      `npm gitHead mismatch: expected ${commit}, found ${versionMetadata.gitHead ?? "missing"}.`,
    );
  }
  const dist = versionMetadata.dist;
  if (
    dist?.integrity !== candidate.integrity ||
    dist?.shasum !== candidate.shasum ||
    dist?.fileCount !== candidate.fileCount
  ) {
    throw new Error("npm dist identity does not match the verified candidate tarball.");
  }
  const registryVersion = packageMetadata.versions[version];
  if (
    registryVersion?.dist?.integrity !== candidate.integrity ||
    registryVersion?.dist?.shasum !== candidate.shasum
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
    dist.tarball,
    "npm tarball URL",
  );
  const attestationUrl = assertTrustedRegistryUrl(
    dist.attestations?.url,
    "npm attestation URL",
  );
  if (dist.attestations?.provenance?.predicateType !== provenanceType) {
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

  for (let index = 0; index < assetPaths.length; index += 1) {
    const path = assetPaths[index];
    const response = assetResponses[index];
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("image/svg+xml")) {
      throw new Error(`jsDelivr asset ${path} did not return SVG content.`);
    }
    const publishedAsset = Buffer.from(await response.arrayBuffer());
    if (!publishedAsset.equals(requiredEntry(candidate.entries, path))) {
      throw new Error(`jsDelivr asset ${path} does not match the candidate tarball.`);
    }
  }

  const invocationId = verifyAttestations({
    document: attestationDocument,
    packageName,
    version,
    sha512: candidate.sha512,
    commit,
    tag,
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
    readmeFilename: candidateReadmeFilename,
    provenanceInvocation: invocationId,
    assets: assetPaths.map(
      (path) => `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
    ),
  };
}

export async function verifyNpmReleaseEventually(
  release,
  {
    attempts = 12,
    delayMs = 10_000,
    fetchImpl = globalThis.fetch,
    sleepImpl = (duration) =>
      new Promise((resolveDelay) => setTimeout(resolveDelay, duration)),
    onRetry = () => {},
  } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("Verification attempts must be a positive integer.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error("Verification delay must be a non-negative integer.");
  }

  let lastError;
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
    `Published release verification failed after ${attempts} attempts: ${lastError.message}`,
  );
}

function parseArguments(argv) {
  const names = new Map([
    ["--package-name", "packageName"],
    ["--version", "version"],
    ["--dist-tag", "distTag"],
    ["--commit", "commit"],
    ["--tag", "tag"],
    ["--tarball", "tarballPath"],
  ]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    const name = names.get(option);
    if (!name || !value) {
      throw new Error(
        "Usage: node scripts/verify-npm-release.mjs --package-name <name> --version <version> --dist-tag <tag> --commit <sha> --tag <release-tag> --tarball <path>",
      );
    }
    values[name] = value;
  }
  if ([...names.values()].some((name) => !values[name])) {
    throw new Error(
      "Usage: node scripts/verify-npm-release.mjs --package-name <name> --version <version> --dist-tag <tag> --commit <sha> --tag <release-tag> --tarball <path>",
    );
  }
  return values;
}

async function main() {
  const release = parseArguments(process.argv.slice(2));
  const result = await verifyNpmReleaseEventually(release, {
    onRetry({ attempt, attempts, error }) {
      process.stderr.write(
        `VERIFY_RETRY attempt=${attempt}/${attempts} reason=${error.message}\n`,
      );
    },
  });
  process.stdout.write(`VERIFY_NPM_RELEASE_OK ${JSON.stringify(result)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
