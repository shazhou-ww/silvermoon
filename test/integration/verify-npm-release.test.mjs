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
const tarballUrl = `${registry}/silvermoon/-/silvermoon-${version}.tgz`;
const attestationUrl =
  `${registry}/-/npm/v1/attestations/silvermoon@${version}`;
const assets = [
  "assets/silvermoon.svg",
  "assets/silvermoon-avatar.svg",
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
  const assetContents = new Map([
    ["assets/silvermoon.svg", Buffer.from("<svg>hero</svg>\n")],
    ["assets/silvermoon-avatar.svg", Buffer.from("<svg>avatar</svg>\n")],
  ]);
  const assetUrls = assets.map(
    (path) => `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
  );
  const englishReadme = [
    "# Fixture",
    ...assetUrls.map((url) => `<img src="${url}">`),
    "",
  ].join("\n");
  const chineseReadme = [
    "# 测试",
    ...assetUrls.map((url) => `<img src="${url}">`),
    "",
  ].join("\n");
  await Promise.all([
    writeFile(
      join(packageDirectory, "package.json"),
      `${JSON.stringify({
        name: packageName,
        version,
        files: ["assets"],
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
    versions: { [version]: { dist } },
  };
  const versionMetadata = {
    name: packageName,
    version,
    gitHead: commit,
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
        return new Response(
          overrides.asset ?? assetContents.get(assets[assetIndex]),
          { headers: { "content-type": "image/svg+xml" } },
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
        fetchImpl: fetchFor({ asset: Buffer.from("<svg>different</svg>") }),
      }),
    /jsDelivr asset .* does not match/,
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
});
