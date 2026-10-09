import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import {
  CACHE_TTL_MS,
  compareSemanticVersions,
  inspectInstallation,
  inspectPersonalSkill,
  inspectRuntimeUpdate,
} from "../../src/foundation/installation/index.ts";
import { observeDevice } from "../../src/business/shared/observe-device.ts";

test("compares stable and prerelease semantic versions", () => {
  assert.equal(compareSemanticVersions("0.4.0", "0.4.0"), 0);
  assert.equal(compareSemanticVersions("0.4.0", "0.4.1"), -1);
  assert.equal(compareSemanticVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareSemanticVersions("1.0.0-alpha.2", "1.0.0-alpha.10"), -1);
  assert.equal(compareSemanticVersions("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compareSemanticVersions("not-a-version", "1.0.0"), null);
});

test("caches successful latest checks for less than 24 hours", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-runtime-cache-"));
  const initialTime = Date.parse("2026-01-01T00:00:00.000Z");
  let requests = 0;
  try {
    const first = await inspectRuntimeUpdate({
      currentVersion: "0.3.0",
      home,
      now: initialTime,
      requestLatest: async () => {
        requests += 1;
        return "0.4.0";
      },
    });
    assert.equal(first.status, "available");
    assert.equal(first.source, "registry");

    const cached = await inspectRuntimeUpdate({
      currentVersion: "0.3.0",
      home,
      now: initialTime + CACHE_TTL_MS - 1,
      requestLatest: async () => {
        throw new Error("fresh cache must prevent a registry request");
      },
    });
    assert.equal(cached.status, "available");
    assert.equal(cached.source, "cache");
    assert.equal(requests, 1);

    const current = await inspectRuntimeUpdate({
      currentVersion: "0.4.0",
      home,
      now: initialTime + CACHE_TTL_MS - 1,
      requestLatest: async () => {
        throw new Error("fresh cache must prevent a registry request");
      },
    });
    assert.equal(current.status, "current");
    assert.equal(current.source, "cache");

    const refreshed = await inspectRuntimeUpdate({
      currentVersion: "0.4.0",
      home,
      now: initialTime + CACHE_TTL_MS,
      requestLatest: async () => {
        requests += 1;
        return "0.4.1";
      },
    });
    assert.equal(refreshed.status, "available");
    assert.equal(refreshed.source, "registry");
    assert.equal(requests, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("forced checks bypass fresh cache and failures preserve successful freshness", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-runtime-force-"));
  const cachePath = join(home, ".cache", "silvermoon", "runtime-latest.json");
  const initialTime = Date.parse("2026-01-01T00:00:00.000Z");
  try {
    await inspectRuntimeUpdate({
      currentVersion: "0.3.0",
      home,
      now: initialTime,
      requestLatest: async () => "0.4.0",
    });
    const forced = await inspectRuntimeUpdate({
      currentVersion: "0.4.0",
      force: true,
      home,
      now: initialTime + 1,
      requestLatest: async () => "0.4.1",
    });
    assert.equal(forced.status, "available");
    assert.equal(forced.source, "registry");

    const beforeFailure = await readFile(cachePath, "utf8");
    const unavailable = await inspectRuntimeUpdate({
      currentVersion: "0.4.0",
      home,
      now: initialTime + CACHE_TTL_MS + 2,
      requestLatest: async () => {
        throw new Error("registry offline");
      },
    });
    assert.equal(unavailable.status, "unavailable");
    assert.equal(
      "lastSuccessfulCheck" in unavailable
        ? unavailable.lastSuccessfulCheck?.latestVersion
        : undefined,
      "0.4.1",
    );
    assert.match(unavailable.summary, /registry offline/);
    assert.equal(await readFile(cachePath, "utf8"), beforeFailure);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("validates personal discovery links without reading a project", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-personal-skill-"));
  const packageSkill = join(home, "package", "skills", "silvermoon");
  const agentsSkill = join(home, ".agents", "skills", "silvermoon");
  const copilotSkill = join(home, ".copilot", "skills", "silvermoon");
  const wrongSkill = join(home, "wrong", "silvermoon");
  try {
    const invalidInstallation = await inspectPersonalSkill({
      home,
      runtimeSource: "global",
      skillRoot: packageSkill,
    });
    assert.equal(invalidInstallation.status, "invalid");
    assert.match(invalidInstallation.summary, /canonical Silvermoon skill/);

    await mkdir(packageSkill, { recursive: true });
    await writeFile(join(packageSkill, "SKILL.md"), "# Canonical\n");

    const missing = await inspectPersonalSkill({
      home,
      runtimeSource: "global",
      skillRoot: packageSkill,
    });
    assert.equal(missing.status, "missing");

    await mkdir(dirname(agentsSkill), { recursive: true });
    await symlink(
      packageSkill,
      agentsSkill,
      process.platform === "win32" ? "junction" : "dir",
    );
    const ready = await inspectPersonalSkill({
      home,
      runtimeSource: "global",
      skillRoot: packageSkill,
    });
    assert.equal(ready.status, "ready");
    assert.deepEqual(ready.paths, [agentsSkill]);

    await mkdir(wrongSkill, { recursive: true });
    await writeFile(join(wrongSkill, "SKILL.md"), "# Stale copy\n");
    await mkdir(dirname(copilotSkill), { recursive: true });
    await symlink(
      wrongSkill,
      copilotSkill,
      process.platform === "win32" ? "junction" : "dir",
    );
    const mismatched = await inspectPersonalSkill({
      home,
      runtimeSource: "global",
      skillRoot: packageSkill,
    });
    assert.equal(mismatched.status, "mismatched");
    assert.deepEqual(mismatched.invalidPaths, [copilotSkill]);

    assert.equal((await inspectPersonalSkill({
      home,
      runtimeSource: "host",
      skillRoot: packageSkill,
    })).status, "managed-by-host");
    assert.equal((await inspectPersonalSkill({
      home,
      runtimeSource: "source-checkout",
      skillRoot: packageSkill,
    })).status, "source-checkout");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("source checkout readiness does not query npm or require a personal skill", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-source-device-"));
  try {
    const device = await observeDevice({
      entryPath: resolve("bin", "silvermoon.ts"),
      env: { PATH: "" },
      userHome: home,
    });
    assert.equal(device.readiness?.runtime.source, "source-checkout");
    assert.equal(device.readiness?.skill.status, "source-checkout");
    assert.equal(device.readiness?.update.status, "source-checkout");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("resolves global and project-local Windows command shims", {
  skip: process.platform !== "win32",
}, async () => {
  const base = await mkdtemp(join(tmpdir(), "silvermoon-windows-shim-"));
  try {
    const globalBin = join(base, "global");
    const globalEntry = join(
      globalBin,
      "node_modules",
      "silvermoon",
      "dist",
      "bin",
      "silvermoon.js",
    );
    const globalShim = join(globalBin, "silvermoon.cmd");
    await mkdir(dirname(globalEntry), { recursive: true });
    await writeFile(globalEntry, "");
    await writeFile(
      globalShim,
      '@"%dp0%\\node_modules\\silvermoon\\dist\\bin\\silvermoon.js" %*\n',
    );
    const global = await inspectInstallation({
      entryPath: globalEntry,
      env: { PATH: globalBin },
      platform: "win32",
    });
    assert.equal(global.source, "global");
    assert.equal(global.executable, globalShim);

    const projectRoot = join(base, "project");
    const localBin = join(projectRoot, "node_modules", ".bin");
    const localEntry = join(
      projectRoot,
      "node_modules",
      "silvermoon",
      "dist",
      "bin",
      "silvermoon.js",
    );
    await mkdir(dirname(localEntry), { recursive: true });
    await mkdir(localBin, { recursive: true });
    await writeFile(localEntry, "");
    await writeFile(
      join(localBin, "silvermoon.cmd"),
      '@"%dp0%\\..\\silvermoon\\dist\\bin\\silvermoon.js" %*\n',
    );
    const local = await inspectInstallation({
      entryPath: localEntry,
      env: { PATH: localBin },
      platform: "win32",
    });
    assert.equal(local.source, "host");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("reports a cache persistence failure without losing a successful registry result", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-cache-write-"));
  try {
    const result = await inspectRuntimeUpdate({
      currentVersion: "0.3.0",
      filesystem: {
        lstat,
        mkdir,
        readFile,
        realpath,
        writeFile: async () => {
          const error = new Error("read-only cache");
          Object.assign(error, { code: "EACCES" });
          throw error;
        },
      },
      home,
      requestLatest: async () => "0.4.0",
    });
    assert.equal(result.status, "available");
    assert.equal(result.latestVersion, "0.4.0");
    assert.match(result.summary ?? "", /could not cache/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
