import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

import {
  fetchPrimary,
  indexSnapshot,
  observeGitCommands,
  resolveCommit,
  resolveSnapshot,
  worktreeSnapshot,
  withTemporaryTree,
  withTemporaryWorktree,
} from "../../src/repository/git.js";
import { createGitSnapshotFileSystem } from "../../src/repository/git-snapshot.js";

const temporaryDirectories = [];
const repository = "https://example.test/owner/repository.git";

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository() {
  const base = await mkdtemp(join(tmpdir(), "silvermoon-git-"));
  temporaryDirectories.push(base);
  const root = join(base, "work");
  const remote = join(base, "remote.git");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "silvermoon test");
  git(root, "config", "user.email", "silvermoon@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  await writeFile(join(root, "README.md"), "fixture\n");
  git(root, "add", "README.md");
  git(root, "commit", "-m", "Initialize fixture");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "push", remote, "main");
  git(
    root,
    "config",
    `url.${pathToFileURL(remote).href}.insteadOf`,
    repository,
  );
  return {
    config: {
      version: 1,
      primaryRepository: repository,
      primaryBranch: "main",
    },
    root,
  };
}

test("fetches primary by URL without a named Git remote", async () => {
  const { config, root } = await createRepository();
  assert.equal(git(root, "remote"), "");
  const refs = git(root, "for-each-ref", "--format=%(refname) %(objectname)");
  const commands = [];

  const primary = await observeGitCommands(
    (args) => commands.push(args),
    () => fetchPrimary(root, config),
  );
  assert.equal(primary, git(root, "rev-parse", "HEAD"));
  git(root, "cat-file", "-e", `${primary}^{commit}`);
  assert.equal(git(root, "for-each-ref", "--format=%(refname) %(objectname)"), refs);
  assert.deepEqual(
    commands.filter(([name]) => name === "fetch" || name === "ls-remote")
      .map(([name]) => name),
    ["fetch"],
  );
});

test("resolves commits", async () => {
  const { root } = await createRepository();
  const commit = resolveCommit(root, "HEAD");
  const snapshot = resolveSnapshot(root, "HEAD");

  assert.equal(commit, git(root, "rev-parse", "HEAD"));
  assert.deepEqual(snapshot, {
    commit,
    tree: git(root, "rev-parse", "HEAD^{tree}"),
  });
  assert.throws(() => resolveCommit(root, "missing-revision"), /Cannot resolve commit/);
  assert.throws(
    () => resolveSnapshot(root, "missing-revision"),
    /Cannot resolve/,
  );
  assert.throws(() => resolveSnapshot(root, "HEAD\nHEAD"), /Cannot resolve/);
});

test("materializes staged and full worktree snapshots without changing caller state", async () => {
  const { root } = await createRepository();
  await writeFile(join(root, "staged.txt"), "staged\n");
  git(root, "add", "staged.txt");
  await writeFile(join(root, "README.md"), "unstaged\n");
  await writeFile(join(root, "untracked.txt"), "untracked\n");
  await mkdir(join(root, "folder"));
  await writeFile(join(root, "folder", "definition.md"), "definition\n");
  git(root, "config", "--unset", "user.name");
  git(root, "config", "--unset", "user.email");
  const status = git(root, "status", "--short");

  const staged = indexSnapshot(root);
  await withTemporaryTree(root, staged.tree, async (worktree) => {
    assert.equal(await readFile(join(worktree, "README.md"), "utf8"), "fixture\n");
    assert.equal(await readFile(join(worktree, "staged.txt"), "utf8"), "staged\n");
    await assert.rejects(readFile(join(worktree, "untracked.txt"), "utf8"), {
      code: "ENOENT",
    });
  });

  const worktree = worktreeSnapshot(root);
  await withTemporaryTree(root, worktree.tree, async (worktree) => {
    assert.equal(await readFile(join(worktree, "README.md"), "utf8"), "unstaged\n");
    assert.equal(await readFile(join(worktree, "staged.txt"), "utf8"), "staged\n");
    assert.equal(await readFile(join(worktree, "untracked.txt"), "utf8"), "untracked\n");
  });

  const scoped = worktreeSnapshot(root, { paths: ["folder"] });
  await withTemporaryTree(root, scoped.tree, async (worktree) => {
    assert.equal(await readFile(join(worktree, "README.md"), "utf8"), "fixture\n");
    assert.equal(
      await readFile(join(worktree, "folder", "definition.md"), "utf8"),
      "definition\n",
    );
    await assert.rejects(readFile(join(worktree, "staged.txt"), "utf8"), {
      code: "ENOENT",
    });
  });

  assert.equal(git(root, "status", "--short"), status);
  assert.equal(git(root, "branch", "--show-current"), "main");
  assert.equal(git(root, "stash", "list"), "");
});

test("materializes immutable commits without Git worktree commands", async () => {
  const { root } = await createRepository();
  const commands = [];

  await observeGitCommands(
    (args) => commands.push(args),
    () => withTemporaryWorktree(root, "HEAD", async (snapshot) => {
      assert.equal(await readFile(join(snapshot, "README.md"), "utf8"), "fixture\n");
    }),
  );

  assert.equal(
    commands.some(([command]) => command === "worktree"),
    false,
    JSON.stringify(commands),
  );
});

test("reads one immutable worktree snapshot after concurrent filesystem changes", async () => {
  const { root } = await createRepository();
  const snapshot = worktreeSnapshot(root);
  const filesystem = createGitSnapshotFileSystem({
    gitRoot: root,
    preload: ({ name }) => name === "README.md",
    root,
    tree: snapshot.tree,
  });

  await writeFile(join(root, "README.md"), "changed after snapshot\n");

  assert.equal(
    await filesystem.readFile(join(root, "README.md"), "utf8"),
    "fixture\n",
  );
  assert.equal(
    await readFile(join(root, "README.md"), "utf8"),
    "changed after snapshot\n",
  );
});

test("reused snapshot index does not inherit flags that conceal worktree edits", async () => {
  const { root } = await createRepository();
  for (const flag of ["assume-unchanged", "skip-worktree"]) {
    git(root, "update-index", `--${flag}`, "README.md");
    await writeFile(join(root, "README.md"), `${flag}\n`);
    const index = git(root, "rev-parse", "--git-path", "index");
    const before = await readFile(join(root, index));
    const { tree } = worktreeSnapshot(root, { reuseIndex: true });
    const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree });
    assert.equal(await filesystem.readFile(join(root, "README.md"), "utf8"), `${flag}\n`);
    assert.deepEqual(await readFile(join(root, index)), before);
    git(root, "update-index", `--no-${flag}`, "README.md");
  }
});

test("reused snapshot index avoids reading unchanged bodies and detects restored-mtime edits", async () => {
  const { root } = await createRepository();
  const log = join(root, "filter-read.log");
  const filter = join(root, "measure-filter.cjs");
  await writeFile(filter, `
const fs = require("node:fs");
const bytes = fs.readFileSync(0);
fs.appendFileSync(${JSON.stringify(log)}, String(bytes.length) + "\\n");
fs.writeFileSync(1, bytes);
`);
  git(root, "config", "filter.measure.clean", `"${process.execPath}" "${filter}"`);
  git(root, "config", "filter.measure.required", "true");
  await writeFile(join(root, ".gitattributes"), "README.md -text filter=measure\n");
  const path = join(root, "README.md");
  const old = new Date("2000-01-01T00:00:00Z");
  await utimes(path, old, old);
  git(root, "add", "README.md", ".gitattributes");
  worktreeSnapshot(root, { reuseIndex: true });
  await writeFile(log, "");
  const first = worktreeSnapshot(root, { reuseIndex: true }).tree;
  const second = worktreeSnapshot(root, { reuseIndex: true }).tree;
  assert.equal(first, second);
  assert.equal(await readFile(log, "utf8"), "");
  await writeFile(path, "changed\n");
  await utimes(path, old, old);
  const changed = worktreeSnapshot(root, { reuseIndex: true }).tree;
  assert.notEqual(changed, first);
  assert.ok(Number((await readFile(log, "utf8")).trim().split("\n")[0]) > 0);
  const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree: changed });
  assert.equal(await filesystem.readFile(path, "utf8"), "changed\n");
});

test("precise snapshot verification rejects a source changed during index refresh", async () => {
  const { root } = await createRepository();
  await observeGitCommands((args) => {
    if (args.includes("add")) writeFileSync(join(root, "README.md"), "concurrent edit\n");
  }, () => assert.throws(() => worktreeSnapshot(root, { reuseIndex: true }),
    /source changed while taking its snapshot/));
});

test("authenticated native timestamps invalidate restored-mtime edits even without matching Git ctime semantics", async () => {
  const { root } = await createRepository();
  const old = new Date(0);
  const path = join(root, "README.md");
  await utimes(path, old, old);
  git(root, "add", "README.md");
  const index = git(root, "rev-parse", "--git-path", "index");
  const original = await readFile(join(root, index));
  const first = worktreeSnapshot(root, { reuseIndex: true, authenticateSources: true }).tree;
  assert.equal(worktreeSnapshot(root, { reuseIndex: true, authenticateSources: true }).tree, first);
  await writeFile(path, "changed\n");
  await utimes(path, old, old);
  const changed = worktreeSnapshot(root, { reuseIndex: true, authenticateSources: true }).tree;
  assert.notEqual(changed, first);
  assert.deepEqual(await readFile(join(root, index)), original);
});

test("unauthenticated native source records cannot conceal worktree edits", async () => {
  const { root } = await createRepository();
  worktreeSnapshot(root, { reuseIndex: true, authenticateSources: true });
  const canonicalRoot = resolve(git(root, "rev-parse", "--show-toplevel"));
  const worktree = createHash("sha256").update(canonicalRoot).digest("hex");
  const directory = git(root, "rev-parse", "--path-format=absolute", "--git-path", `silvermoon-event-cache/${worktree}`);
  const name = (await readdir(directory)).find((name) => name.endsWith(".json"));
  const path = join(directory, name);
  const record = JSON.parse(await readFile(path, "utf8"));
  const payload = JSON.parse(record.payload);
  payload.state[0].fingerprint = "forged";
  record.payload = JSON.stringify(payload);
  await writeFile(path, JSON.stringify(record));
  await writeFile(join(root, "README.md"), "concurrent\n");
  assert.throws(() => worktreeSnapshot(root, { reuseIndex: true, authenticateSources: true }),
    /Unauthenticated derived event cache/);
  assert.equal(await readFile(join(root, "README.md"), "utf8"), "concurrent\n");
});
