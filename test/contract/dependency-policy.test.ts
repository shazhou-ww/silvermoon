import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import semver from "semver";
import { parseDocument } from "yaml";

const repositoryRoot = new URL("../../", import.meta.url);

async function read(path: string) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("keeps runtime dependencies inside their supported engine and peer ranges", async () => {
  const [manifestSource, lockSource] = await Promise.all([
    read("package.json"),
    read("pnpm-lock.yaml"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const lock = parseDocument(lockSource).toJS();
  const importer = lock.importers["."].dependencies;

  assert.equal(manifest.dependencies.commander, "^15.0.0");
  assert.equal(manifest.engines.node, ">=22.13.0");
  const objectivePackage = "@potential-guide/objective-guide";
  assert.equal(manifest.dependencies[objectivePackage], "0.1.0");
  assert.deepEqual(importer[objectivePackage], { specifier: "0.1.0", version: "0.1.0" });
  assert.equal(
    semver.subset(manifest.engines.node, lock.packages[`${objectivePackage}@0.1.0`].engines.node),
    true,
  );
  assert.ok(!("jsonata" in manifest.dependencies));
  assert.ok(!("ajv" in manifest.dependencies));
  assert.equal(manifest.devDependencies.ajv, "^8.20.0");
  assert.equal(importer.commander.specifier, manifest.dependencies.commander);
  assert.equal(importer.commander.version, "15.0.0");
  assert.equal(lock.packages["commander@15.0.0"].engines.node, ">=22.12.0");
  assert.equal(
    semver.subset(
      manifest.engines.node,
      lock.packages["commander@15.0.0"].engines.node,
    ),
    true,
  );

  const openTuiPeers =
    lock.packages["@jitl/opentui-react@0.4.0"].peerDependencies;
  for (const dependency of ["react-devtools-core", "ws"]) {
    const projectRange = manifest.dependencies[dependency];
    const peerRange = openTuiPeers[dependency];
    const lockedVersion = importer[dependency].version;
    assert.equal(importer[dependency].specifier, projectRange);
    assert.equal(
      semver.subset(projectRange, peerRange),
      true,
      `${dependency} project range must stay inside ${peerRange}`,
    );
    assert.equal(
      semver.satisfies(lockedVersion, peerRange),
      true,
      `${dependency}@${lockedVersion} must satisfy ${peerRange}`,
    );
  }
});
