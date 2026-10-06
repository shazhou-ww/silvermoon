import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  loadUserConfig,
  serializeUserConfig,
  USER_CONFIG_PATH,
} from "../../src/foundation/device-config/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function homeWithConfig(source: string) {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-user-config-"));
  temporaryDirectories.push(home);
  const directory = join(home, ".config", "silvermoon");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "config.yaml"), source);
  return home;
}

test("treats a missing user configuration as no preference", async () => {
  const home = await mkdtemp(join(tmpdir(), "silvermoon-user-config-missing-"));
  temporaryDirectories.push(home);
  const loaded = await loadUserConfig({ home });
  assert.equal(loaded.config, null);
  assert.deepEqual(loaded.diagnostics, []);
  assert.equal(loaded.configPath, join(home, ...USER_CONFIG_PATH.split("/")));
});

test("loads and serializes canonical user configuration", async () => {
  const source = "version: 1\npreferredLanguage: zh-CN\n";
  const loaded = await loadUserConfig({ home: await homeWithConfig(source) });
  assert.deepEqual(loaded.diagnostics, []);
  assert.deepEqual(loaded.config, { version: 1, preferredLanguage: "zh-CN" });
  assert.equal(serializeUserConfig(loaded.config), source);
});

test("rejects invalid, unknown, and noncanonical user configuration", async () => {
  const fixtures: ReadonlyArray<readonly [string, string]> = [
    ["preferredLanguage: zh-CN\n", "user-config.missing-version"],
    ["version: 2\n", "user-config.unsupported-version"],
    ["version: 1\nlanguage: zh-CN\n", "user-config.unknown-key"],
    ["version: 1\npreferredLanguage: zh-cn\n", "user-config.invalid-preferred-language"],
    ["preferredLanguage: zh-CN\nversion: 1\n", "user-config.noncanonical"],
    ["- version: 1\n", "user-config.invalid-type"],
  ];
  for (const [source, code] of fixtures) {
    const loaded = await loadUserConfig({ home: await homeWithConfig(source) });
    assert.equal(loaded.config, null, source);
    const [diagnostic] = loaded.diagnostics;
    assert.ok(diagnostic, source);
    assert.equal(diagnostic.code, code, source);
    assert.match(diagnostic.path, /config\.yaml/);
  }
});

test("rejects a symlinked user configuration file", async (context) => {
  if (process.platform === "win32") {
    context.skip("Windows symlink creation requires privileges unavailable in standard CI");
    return;
  }
  const home = await mkdtemp(join(tmpdir(), "silvermoon-user-config-symlink-"));
  const target = await mkdtemp(join(tmpdir(), "silvermoon-user-config-target-"));
  temporaryDirectories.push(home, target);
  const directory = join(home, ".config", "silvermoon");
  await mkdir(directory, { recursive: true });
  const targetFile = join(target, "config.yaml");
  await writeFile(targetFile, "version: 1\n");
  await symlink(targetFile, join(directory, "config.yaml"), "file");

  const loaded = await loadUserConfig({ home });
  assert.equal(loaded.config, null);
  const [diagnostic] = loaded.diagnostics;
  assert.ok(diagnostic);
  assert.equal(diagnostic.code, "user-config.invalid-file");
});
