import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { runCli } from "../../src/cli.js";
import { observeGitCommands } from "../../src/git.js";
import { listIdeas } from "../../src/list-ideas.js";
import { ideaPaths } from "../../src/layout.js";
import {
  createRepository,
  git,
  setIdeaState,
  writeIdea,
} from "../helpers/repository.js";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const temporaryDirectories = [];

function idAt(timestamp, suffix) {
  let value = BigInt(Date.parse(timestamp));
  let encoded = "";
  for (let index = 0; index < 10; index += 1) {
    encoded = ALPHABET[Number(value % 32n)] + encoded;
    value /= 32n;
  }
  return `${encoded}${suffix.repeat(16)}`;
}

const IDEAS = [
  {
    id: idAt("2026-09-25T00:00:00.000Z", "A"),
    state: "preparing",
    alias: "alpha",
    title: "# Alpha inventory\n",
  },
  {
    id: idAt("2026-09-26T00:00:00.000Z", "B"),
    state: "implementing",
    alias: "beta",
    title: "# Build **Beta** query\n",
  },
  {
    id: idAt("2026-09-27T00:00:00.000Z", "C"),
    state: "deploying",
    title: "## No level-one title\n",
  },
  {
    id: idAt("2026-09-28T00:00:00.000Z", "D"),
    state: "completed",
    alias: "done",
    title: "# Completed work\n",
  },
  {
    id: idAt("2026-09-29T00:00:00.000Z", "E"),
    state: "abandoned",
    alias: "retired",
    title: "# Retired work\n",
  },
];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function fixture() {
  const repository = await createRepository({
    ideas: IDEAS.map(({ id, alias }) => ({
      id,
      status: alias === undefined ? {} : { alias },
    })),
    prefix: "silvermoon-list-ideas-",
  });
  temporaryDirectories.push(repository.base);
  for (const idea of IDEAS) {
    const path = ideaPaths(idea.id).ideaDocumentPath;
    await writeFile(join(repository.root, ...path.split("/")), idea.title);
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add inventory titles");
  for (const idea of IDEAS) {
    await setIdeaState(
      repository.root,
      idea.id,
      idea.state,
      idea.alias === undefined ? {} : { alias: idea.alias },
    );
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set inventory states");
  return repository;
}

function capture() {
  const logs = [];
  const errors = [];
  return {
    errors,
    io: {
      error: (value) => errors.push(value),
      log: (value) => logs.push(value),
    },
    logs,
  };
}

test("[inventory-default] lists active ideas from the local snapshot with four projections", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });
  const commands = [];
  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => listIdeas({ root: nested, userHome: repository.base }),
  );

  assert.deepEqual(Object.keys(report), [
    "intention",
    "observation",
    "actions",
    "response",
  ]);
  assert.deepEqual(report.intention, {
    command: "list-ideas",
    args: {
      states: ["preparing", "implementing", "deploying"],
      query: null,
      createdSince: null,
      createdBefore: null,
      sort: "newest",
      limit: null,
    },
  });
  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.deepEqual(report.actions, []);
  assert.deepEqual(
    report.observation.ideas.map(({ id }) => id),
    IDEAS.slice(0, 3).toReversed().map(({ id }) => id),
  );
  assert.deepEqual(report.observation.summary, {
    matched: 3,
    returned: 3,
    truncated: false,
    counts: {
      preparing: 1,
      implementing: 1,
      deploying: 1,
      completed: 0,
      abandoned: 0,
    },
  });
  assert.equal(report.observation.ideas[1].title, "Build Beta query");
  assert.equal(
    Object.hasOwn(report.observation.ideas[0], "alias"),
    false,
  );
  assert.equal(
    Object.hasOwn(report.observation.ideas[0], "title"),
    false,
  );
  assert.equal(report.response.kind, "idea-list");
  assert.deepEqual(report.response.query, report.intention.args);
  assert.deepEqual(report.response.inventory, report.observation.summary);
  assert.deepEqual(report.response.items, report.observation.ideas);
  assert.equal(
    commands.some(([subcommand]) =>
      ["fetch", "ls-remote", "status", "merge-base"].includes(subcommand)
    ),
    false,
  );
});

test("[inventory-empty] returns a successful complete shape for an empty inventory", async () => {
  const repository = await createRepository({
    ideas: [],
    prefix: "silvermoon-list-empty-",
  });
  temporaryDirectories.push(repository.base);

  const report = await listIdeas({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "ideas-listed");
  assert.deepEqual(report.observation.ideas, []);
  assert.deepEqual(report.observation.summary, {
    matched: 0,
    returned: 0,
    truncated: false,
    counts: {
      preparing: 0,
      implementing: 0,
      deploying: 0,
      completed: 0,
      abandoned: 0,
    },
  });
  assert.deepEqual(report.response.items, []);
});

test("[inventory-filters] combines all filters, time bounds, stable sorting, and limit", async () => {
  const repository = await fixture();
  const all = await listIdeas({
    all: true,
    limit: 2,
    root: repository.root,
    sort: "oldest",
    userHome: repository.base,
  });
  assert.deepEqual(
    all.observation.ideas.map(({ id }) => id),
    IDEAS.slice(0, 2).map(({ id }) => id),
  );
  assert.equal(all.observation.summary.matched, 5);
  assert.equal(all.observation.summary.returned, 2);
  assert.equal(all.observation.summary.truncated, true);
  assert.deepEqual(Object.values(all.observation.summary.counts), [1, 1, 1, 1, 1]);

  const filtered = await listIdeas({
    createdBefore: "2026-09-27T00:00:00Z",
    createdSince: "2026-09-26T00:00:00+00:00",
    query: "BETA",
    root: repository.root,
    states: ["active", "completed", "active"],
    userHome: repository.base,
  });
  assert.deepEqual(
    filtered.observation.ideas.map(({ id }) => id),
    [IDEAS[1].id],
  );
  assert.equal(filtered.intention.args.createdSince, "2026-09-26T00:00:00.000Z");
  assert.equal(filtered.intention.args.createdBefore, "2026-09-27T00:00:00.000Z");
});

test("[inventory-worktree] includes staged, unstaged, and untracked idea content", async () => {
  const repository = await fixture();
  const existingPath = ideaPaths(IDEAS[0].id).ideaDocumentPath;
  await writeFile(
    join(repository.root, ...existingPath.split("/")),
    "# Staged title\n",
  );
  git(repository.root, "add", existingPath);
  await writeFile(
    join(repository.root, ...existingPath.split("/")),
    "# Latest worktree title\n",
  );

  const untrackedId = idAt("2026-09-30T00:00:00.000Z", "F");
  const untracked = await writeIdea(
    repository.root,
    untrackedId,
    { alias: "untracked-idea" },
  );
  await writeFile(
    join(repository.root, ...untracked.ideaDocumentPath.split("/")),
    "# Untracked idea\n",
  );

  const report = await listIdeas({
    all: true,
    root: repository.root,
    userHome: repository.base,
  });
  const existing = report.observation.ideas.find(({ id }) => id === IDEAS[0].id);
  const added = report.observation.ideas.find(({ id }) => id === untrackedId);
  assert.equal(existing.title, "Latest worktree title");
  assert.equal(existing.state, "preparing");
  assert.equal(added.alias, "untracked-idea");
  assert.equal(added.title, "Untracked idea");
  assert.equal(added.state, "preparing");
});

test("[inventory-readiness] ignores worktree, branch, upstream, ancestry, and network readiness", async () => {
  const repository = await fixture();
  git(repository.root, "branch", "--unset-upstream");
  git(repository.root, "checkout", "--detach");
  await writeFile(join(repository.root, "dirty-untracked.txt"), "local only\n");
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => listIdeas({ all: true, root: repository.root, userHome: repository.base }),
  );

  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(report.observation.summary.matched, 5);
  assert.deepEqual(report.actions, []);
  assert.equal(
    commands.some(([subcommand]) =>
      ["fetch", "ls-remote", "status", "merge-base", "rev-list"].includes(
        subcommand,
      )
    ),
    false,
  );
});

test("[inventory-conflict] ignores an unrelated unresolved merge conflict", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "conflict.txt"), "base\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add conflict base");
  git(repository.root, "push", "origin", "main");
  git(repository.root, "checkout", "-b", "other");
  await writeFile(join(repository.root, "conflict.txt"), "other\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Change conflict on other");
  git(repository.root, "checkout", "main");
  await writeFile(join(repository.root, "conflict.txt"), "main\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Change conflict on main");
  const merged = spawnSync(
    "git",
    ["-C", repository.root, "merge", "other"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.notEqual(merged.status, 0);

  const report = await listIdeas({
    all: true,
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(report.observation.summary.matched, 5);
  assert.deepEqual(report.actions, []);
});

test("[inventory-usage] rejects invalid arguments before Git access or trace creation", async () => {
  const commands = [];
  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => listIdeas({ root: "missing", states: ["unknown"] }),
    ),
    (caught) => caught.exitCode === 2,
  );
  assert.deepEqual(commands, []);

  const traceRoot = await mkdtemp(join(tmpdir(), "silvermoon-list-usage-"));
  temporaryDirectories.push(traceRoot);
  const trace = join(traceRoot, "invalid.trace.jsonl");
  const output = capture();
  assert.equal(
    await runCli(
      [
        "list-ideas",
        "--query",
        "   ",
        "--root",
        "missing",
        "--trace",
        trace,
      ],
      output.io,
    ),
    2,
  );
  assert.equal(output.logs.length, 0);
  assert.match(output.errors[0], /query must be a non-empty string/);
  await assert.rejects(access(trace), { code: "ENOENT" });
});

test("[inventory-layout] fails explicitly on invalid layout even when filters would hide it", async () => {
  const repository = await fixture();
  const hidden = ideaPaths(IDEAS[4].id);
  await rm(join(repository.root, ...hidden.ledgerPath.split("/")));

  const report = await listIdeas({
    root: repository.root,
    states: ["preparing"],
    userHome: repository.base,
  });
  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.equal(report.response.kind, "blocked");
  assert.deepEqual(report.actions, []);
  assert.ok(
    report.observation.problems.some(
      ({ type }) => type === "idea-ledger-missing-file",
    ),
  );

  const output = capture();
  assert.equal(
    await runCli(
      ["list-ideas", "--state", "preparing", "--root", repository.root, "--json"],
      output.io,
    ),
    1,
  );
  assert.equal(JSON.parse(output.logs[0]).response.kind, "blocked");
  assert.deepEqual(output.errors, []);
});

test("[inventory-cli] CLI renders complete local inventory without lifecycle instructions", async () => {
  const repository = await fixture();
  const json = capture();
  assert.equal(
    await runCli(
      [
        "list-ideas",
        "--all",
        "--sort",
        "oldest",
        "--limit",
        "1",
        "--root",
        repository.root,
        "--json",
      ],
      json.io,
    ),
    0,
  );
  const report = JSON.parse(json.logs[0]);
  assert.equal(report.response.kind, "idea-list");
  assert.equal(report.response.inventory.matched, 5);
  assert.equal(report.response.inventory.returned, 1);
  assert.equal(report.response.inventory.truncated, true);

  const text = capture();
  assert.equal(
    await runCli(
      ["list-ideas", "--state", "active", "--root", repository.root],
      text.io,
    ),
    0,
  );
  assert.match(text.logs[0], /^## Ideas/);
  assert.match(text.logs[0], /States: `preparing`, `implementing`, `deploying`/);
  assert.match(text.logs[0], /Created=`2026-/);
  assert.doesNotMatch(text.logs[0], /Next steps|create-idea|whats-next/);
  assert.deepEqual(text.errors, []);
});
