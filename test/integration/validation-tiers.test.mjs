import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { observePackageRisk } from "../../scripts/ci-package-risk.mjs";
import { createRepository, FIRST_ID, git } from "../helpers/repository.js";

const cli = fileURLToPath(new URL("../../bin/silvermoon.js", import.meta.url));
const runner = new URL("../../scripts/run-checks.mjs", import.meta.url);

test("sanity preload reaches real test workers and blocks accidental process and network calls", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silvermoon-sanity-boundary-"));
  try {
    const path = join(directory, "probe.test.mjs");
    await writeFile(path, `
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
test("guard is active", () => {
  assert.throws(() => spawnSync("git", ["--version"]), /SANITY_IO_FORBIDDEN/);
  assert.throws(() => fetch("http://127.0.0.1:9"), /SANITY_IO_FORBIDDEN/);
});
`);
    const result = spawnSync(process.execPath, [
      "--import", new URL("../helpers/sanity-guard.mjs", import.meta.url).href,
      "--test", path,
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("commit scope keeps partial staging intact and validates the index, not worktree metadata", async () => {
  const repository = await createRepository({ prefix: "silvermoon-tier-index-", withRemote: false });
  try {
    const { root, base } = repository;
    await mkdir(join(root, "scripts"));
    await copyFile(runner, join(root, "scripts", "run-checks.mjs"));
    const sample = join(root, "candidate.txt");
    await writeFile(sample, "staged candidate");
    git(root, "add", "candidate.txt");
    await writeFile(sample, "worktree candidate");

    const packageManager = join(base, "fixture-package-manager.mjs");
    await writeFile(packageManager, `
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const script = process.argv[3];
if (script === "check:staged") {
  const result = spawnSync(process.execPath, [${JSON.stringify(cli)}, "check", "--root", process.cwd(), "--staged", "--audience", "agent"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
console.log("FIXTURE_WORKTREE " + script + ": " + readFileSync("candidate.txt", "utf8"));
`);
    const execute = () => spawnSync(process.execPath, ["scripts/run-checks.mjs", "--tier", "commit"], {
      cwd: root, encoding: "utf8",
      env: { ...process.env, npm_execpath: packageManager },
      windowsHide: true,
    });
    const before = git(root, "status", "--porcelain=v1", "--untracked-files=all");
    const index = git(root, "write-tree");
    const result = execute();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Tests validate the WORKTREE, not staged code/);
    assert.match(result.stdout, /Partial staging is NOT exact-candidate test evidence/);
    assert.match(result.stdout, /FIXTURE_WORKTREE check:sanity: worktree candidate/);
    assert.equal(git(root, "show", ":candidate.txt"), "staged candidate");
    assert.equal(git(root, "write-tree"), index);
    assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all"), before);

    const statusPath = `.silvermoon/ideas/${FIRST_ID}/status.yaml`;
    const valid = await readFile(join(root, statusPath), "utf8");
    await writeFile(join(root, statusPath), "version: invalid\n");
    git(root, "add", statusPath);
    await writeFile(join(root, statusPath), valid);
    const invalidIndex = git(root, "write-tree");
    const failed = execute();
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    assert.match(failed.stderr, /check:staged.*exit code 1/);
    assert.equal(git(root, "write-tree"), invalidIndex);
    assert.equal(await readFile(join(root, statusPath), "utf8"), valid);
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});

test("real Git risk selection covers deletion, rename, absent history and explicit full mode", async () => {
  const repository = await createRepository({ prefix: "silvermoon-tier-risk-", withRemote: false });
  try {
    const { root } = repository;
    const ledger = `.silvermoon/ideas/${FIRST_ID}/ledger.md`;
    await writeFile(join(root, "shipped.txt"), "package content\n");
    git(root, "add", "shipped.txt");
    git(root, "commit", "-m", "risk baseline");
    const base = git(root, "rev-parse", "HEAD");
    await writeFile(join(root, ledger), "# Changed ledger\n");
    git(root, "add", ledger);
    git(root, "commit", "-m", "only metadata");
    assert.equal(observePackageRisk({ base, cwd: root }).required, false);
    git(root, "mv", "shipped.txt", `.silvermoon/ideas/${FIRST_ID}/moved.txt`);
    git(root, "commit", "-m", "rename shipped file to metadata");
    assert.equal(observePackageRisk({ base, cwd: root }).required, true);
    assert.equal(observePackageRisk({ base: "f".repeat(40), cwd: root }).required, true);
    assert.equal(observePackageRisk({ base, cwd: root, full: true }).required, true);
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});
