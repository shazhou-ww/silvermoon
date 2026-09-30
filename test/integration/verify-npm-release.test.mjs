import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { buildNpmTarball } from "../../scripts/build-npm-tarball.mjs";
import {
  verifyNpmRelease,
  verifyNpmReleaseEventually,
} from "../../scripts/verify-npm-release.mjs";

const temporaryDirectories = [];
const packageName = "silvermoon";
const version = "1.2.3";
const distTag = "latest";
const commit = "a".repeat(40);
const tag = `npm/silvermoon/v${version}`;
const repository = "shazhou-ww/silvermoon";
const registry = "https://registry.npmjs.org";
const publicMetadata = {
  license: "MIT",
  homepage: `https://github.com/${repository}#readme`,
  bugs: { url: `https://github.com/${repository}/issues` },
  repository: {
    type: "git",
    url: `git+https://github.com/${repository}.git`,
  },
};
const publicMaintainer = {
  name: "shazhou-ww",
  url: "https://github.com/shazhou-ww",
};
const tarballUrl = `${registry}/silvermoon/-/silvermoon-${version}.tgz`;
const attestationUrl =
  `${registry}/-/npm/v1/attestations/silvermoon@${version}`;
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const assets = [
  "assets/silvermoon.svg",
  "assets/silvermoon-avatar.svg",
  "assets/silvermoon-mascot.png",
];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function statement(predicateType, predicate, sha512) {
  return {
    predicateType,
    bundle: {
      dsseEnvelope: {
        payload: Buffer.from(JSON.stringify({
          _type: "https://in-toto.io/Statement/v1",
          subject: [{
            name: `pkg:npm/${packageName}@${version}`,
            digest: { sha512 },
          }],
          predicateType,
          predicate,
        })).toString("base64"),
      },
    },
  };
}

test("verifies registry identity, READMEs, provenance, and jsDelivr assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "npm-release-verification-"));
  temporaryDirectories.push(root);
  const packageDirectory = join(root, "package");
  const outputDirectory = join(root, "output");
  await mkdir(join(packageDirectory, "assets"), { recursive: true });
  const assetContents = new Map(
    await Promise.all(
      assets.map(async (path) => [path, await readFile(join(repositoryRoot, path))]),
    ),
  );
  const assetUrls = assets.map(
    (path) => `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
  );
  const readmeAssetUrls = assetUrls.filter(
    (url) => !url.endsWith("/assets/silvermoon-avatar.svg"),
  );
  const englishReadme = [
    "# Fixture",
    ...readmeAssetUrls.map((url) => `<img src="${url}">`),
    "",
  ].join("\n");
  const chineseReadme = [
    "# 测试",
    ...readmeAssetUrls.map((url) => `<img src="${url}">`),
    "",
  ].join("\n");
  assert.doesNotMatch(englishReadme, /silvermoon-avatar\.svg/);
  assert.doesNotMatch(chineseReadme, /silvermoon-avatar\.svg/);
  await Promise.all([
    writeFile(
      join(packageDirectory, "package.json"),
      `${JSON.stringify({
        name: packageName,
        version,
        files: ["README.md", "README.zh-CN.md"],
        ...publicMetadata,
        author: publicMaintainer,
        contributors: [publicMaintainer],
        maintainers: [publicMaintainer],
      }, null, 2)}\n`,
    ),
    writeFile(join(packageDirectory, "README.md"), englishReadme),
    writeFile(join(packageDirectory, "README.zh-CN.md"), chineseReadme),
    ...[...assetContents].map(([path, contents]) =>
      writeFile(join(packageDirectory, path), contents)
    ),
  ]);

  const candidate = await buildNpmTarball({
    packageDirectory,
    outputDirectory,
    gitHead: commit,
  });
  assert.equal(
    candidate.files.some(({ path }) => path.startsWith("assets/")),
    false,
  );
  const tarball = await readFile(candidate.tarballPath);
  const sha512 = createHash("sha512").update(tarball).digest("hex");
  const dist = {
    attestations: {
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
      url: attestationUrl,
    },
    fileCount: candidate.files.length,
    integrity: candidate.integrity,
    shasum: candidate.shasum,
    tarball: tarballUrl,
  };
  const packageMetadata = {
    "dist-tags": { [distTag]: version },
    readme: englishReadme,
    readmeFilename: "README.md",
    versions: { [version]: { ...publicMetadata, dist } },
  };
  const versionMetadata = {
    name: packageName,
    version,
    gitHead: commit,
    ...publicMetadata,
    dist,
  };
  const attestations = {
    attestations: [
      statement(
        "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
        { name: packageName, version, registry },
        sha512,
      ),
      statement(
        "https://slsa.dev/provenance/v1",
        {
          buildDefinition: {
            externalParameters: {
              workflow: {
                path: ".github/workflows/publish-npm.yml",
                ref: `refs/tags/${tag}`,
                repository: `https://github.com/${repository}`,
              },
            },
            resolvedDependencies: [{
              uri: `git+https://github.com/${repository}@refs/tags/${tag}`,
              digest: { gitCommit: commit },
            }],
          },
          runDetails: {
            builder: {
              id: "https://github.com/actions/runner/github-hosted",
            },
            metadata: {
              invocationId:
                `https://github.com/${repository}/actions/runs/123/attempts/1`,
            },
          },
        },
        sha512,
      ),
    ],
  };

  function fetchFor(overrides = {}) {
    const packageDocument = {
      ...packageMetadata,
      ...overrides.packageMetadata,
    };
    const versionDocument = {
      ...versionMetadata,
      ...overrides.versionMetadata,
    };
    return async (url) => {
      const value = String(url);
      if (value === `${registry}/${packageName}`) {
        return jsonResponse(packageDocument);
      }
      if (value === `${registry}/${packageName}/${version}`) {
        return jsonResponse(versionDocument);
      }
      if (value === tarballUrl) {
        return new Response(overrides.tarball ?? tarball);
      }
      if (value === attestationUrl) {
        return jsonResponse(overrides.attestations ?? attestations);
      }
      const assetIndex = assets.findIndex(
        (path) =>
          value === `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
      );
      if (assetIndex !== -1) {
        const contentType = assets[assetIndex].endsWith(".png")
          ? "image/png"
          : "image/svg+xml";
        return new Response(
          overrides.asset ?? assetContents.get(assets[assetIndex]),
          {
            headers: {
              "content-type": overrides.assetContentType ?? contentType,
            },
          },
        );
      }
      return new Response("missing", { status: 404 });
    };
  }

  const release = {
    packageName,
    version,
    distTag,
    commit,
    tag,
    tarballPath: candidate.tarballPath,
  };
  const verified = await verifyNpmRelease(release, {
    fetchImpl: fetchFor(),
  });
  assert.equal(verified.integrity, candidate.integrity);
  assert.equal(verified.fileCount, candidate.files.length);
  assert.equal(verified.license, "MIT");
  assert.equal(verified.homepage, publicMetadata.homepage);
  assert.equal(verified.bugsUrl, publicMetadata.bugs.url);
  assert.equal(
    verified.provenanceInvocation,
    `https://github.com/${repository}/actions/runs/123/attempts/1`,
  );
  assert.deepEqual(verified.assets, assetUrls);

  const prereleaseVerified = await verifyNpmRelease(
    { ...release, distTag: "rc" },
    {
      fetchImpl: fetchFor({
        packageMetadata: {
          "dist-tags": { latest: "1.2.2", rc: version },
          readme: "",
          readmeFilename: "",
        },
      }),
    },
  );
  assert.equal(prereleaseVerified.distTag, "rc");

  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          packageMetadata: { "dist-tags": { latest: "1.2.2" } },
        }),
      }),
    /dist-tag latest does not point to 1\.2\.3/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          packageMetadata: { readme: "# different\n" },
        }),
      }),
    /package README does not match/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({ tarball: Buffer.from("different") }),
      }),
    /tarball bytes do not match/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          versionMetadata: { gitHead: "b".repeat(40) },
        }),
      }),
    /npm gitHead mismatch/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          versionMetadata: { license: "UNLICENSED" },
        }),
      }),
    /npm version metadata license must be MIT/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          packageMetadata: {
            versions: {
              [version]: {
                ...publicMetadata,
                homepage: "https://example.test",
                dist,
              },
            },
          },
        }),
      }),
    /npm package version metadata homepage/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({ asset: Buffer.from("<svg>different</svg>") }),
      }),
    /jsDelivr asset .* does not match/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({ assetContentType: "text/plain" }),
      }),
    /jsDelivr asset .* did not return image\/(svg\+xml|png) content/,
  );
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({
          attestations: {
            attestations: [attestations.attestations[0]],
          },
        }),
      }),
    /npm publish and SLSA provenance attestations are both required/,
  );

  const mismatchedProvenance = structuredClone(attestations);
  const provenanceEnvelope =
    mismatchedProvenance.attestations[1].bundle.dsseEnvelope;
  const provenancePayload = JSON.parse(
    Buffer.from(provenanceEnvelope.payload, "base64").toString("utf8"),
  );
  provenancePayload.predicate.buildDefinition
    .resolvedDependencies[0].digest.gitCommit = "b".repeat(40);
  provenanceEnvelope.payload = Buffer.from(
    JSON.stringify(provenancePayload),
  ).toString("base64");
  await assert.rejects(
    () =>
      verifyNpmRelease(release, {
        fetchImpl: fetchFor({ attestations: mismatchedProvenance }),
      }),
    /SLSA provenance does not resolve the expected release commit/,
  );

  const retries = [];
  await assert.rejects(
    () =>
      verifyNpmReleaseEventually(release, {
        attempts: 2,
        delayMs: 0,
        fetchImpl: async () => new Response("unavailable", { status: 503 }),
        onRetry: ({ attempt }) => retries.push(attempt),
        sleepImpl: async () => {},
      }),
    /failed after 2 attempts.*server returned 503/,
  );
  assert.deepEqual(retries, [1]);

  const relativeOutputDirectory = join(root, "relative-output");
  const relativeReadme = [
    "# Unstaged fixture",
    '<img src="./assets/silvermoon.svg">',
    "",
  ].join("\n");
  const manifestPath = join(packageDirectory, "package.json");
  const relativeManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  relativeManifest.readme = relativeReadme;
  relativeManifest.readmeFilename = "README.md";
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(relativeManifest, null, 2)}\n`),
    writeFile(join(packageDirectory, "README.md"), relativeReadme),
    writeFile(join(packageDirectory, "README.zh-CN.md"), relativeReadme),
  ]);
  const relativeCandidate = await buildNpmTarball({
    packageDirectory,
    outputDirectory: relativeOutputDirectory,
    gitHead: commit,
  });
  await assert.rejects(
    () =>
      verifyNpmRelease(
        { ...release, tarballPath: relativeCandidate.tarballPath },
        {
          fetchImpl: async () => {
            throw new Error("release verification fetched before README validation");
          },
        },
      ),
    /README\.md still contains references that require release rewriting/,
  );
});
