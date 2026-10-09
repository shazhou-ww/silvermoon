import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { runCli } from "../../bin/silvermoon.ts";
import { observeGitCommands } from "../../src/foundation/git/index.ts";
import {
  IdeaMetadataReadError,
  readIdeaInventoryItem,
} from "../../src/business/shared/read-idea-inventory-item.ts";
import { serializeIdeaStatus } from "../../src/foundation/idea-model/index.ts";
import { listIdeas } from "../../src/business/list-ideas.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { withTraceFile } from "../../src/foundation/trace/index.ts";
import {
  createRepository,
  git,
  setIdeaState,
  writeIdea,
} from "../helpers/repository.ts";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const temporaryDirectories: string[] = [];

function idAt(timestamp: string, suffix: string) {
  let value = BigInt(Date.parse(timestamp));
  let encoded = "";
  for (let index = 0; index < 10; index += 1) {
    const character = ALPHABET[Number(value % 32n)];
    assert.ok(character);
    encoded = character + encoded;
    value /= 32n;
  }
  return `${encoded}${suffix.repeat(16)}`;
}

const IDEAS: Array<{
  id: string;
  state: "preparing" | "implementing" | "deploying" | "completed" | "abandoned";
  alias?: string;
  title: string;
}> = [
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

async function fixture({
  withRemote = false,
  withUpstream = false,
}: {
  withRemote?: boolean;
  withUpstream?: boolean;
} = {}) {
  const repository = await createRepository({
    ideas: IDEAS.map(({ id, alias }) => ({
      id,
      status: alias === undefined ? {} : { alias },
    })),
    prefix: "silvermoon-list-ideas-",
    withRemote,
    withUpstream,
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
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    errors,
    io: {
      error: (value: unknown) => {
        assert.ok(typeof value === "string");
        errors.push(value);
      },
      log: (value: unknown) => {
        assert.ok(typeof value === "string");
        logs.push(value);
      },
    },
    logs,
  };
}

function firstLog(output: ReturnType<typeof capture>) {
  const value = output.logs.at(0);
  assert.ok(value);
  return value;
}

function ideaAt(index: number) {
  const idea = IDEAS.at(index);
  assert.ok(idea);
  return idea;
}

test("[inventory-default] lists active ideas from the local snapshot with four projections", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });
  const commands: (readonly string[])[] = [];
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
      language: null,
    },
  });
  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.deepEqual(report.actions, []);
  assert.deepEqual(
    report.observation.ideas.map(({ id }: { id: string }) => id),
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
  assert.equal(report.observation.ideas.at(1)?.title, "Build Beta query");
  const newestIdea = report.observation.ideas.at(0);
  assert.ok(newestIdea);
  assert.equal(
    Object.hasOwn(newestIdea, "alias"),
    false,
  );
  assert.equal(
    Object.hasOwn(newestIdea, "title"),
    false,
  );
  assert.equal(report.response.kind, "idea-list");
  assert.deepEqual(report.response.query, report.intention.args);
  assert.deepEqual(report.response.inventory, report.observation.summary);
  assert.deepEqual(report.response.items, report.observation.ideas);
  assert.equal(
    commands.some(([subcommand]) =>
      subcommand !== undefined
      && ["fetch", "ls-remote", "status", "merge-base"].includes(subcommand)
    ),
    false,
  );
});

test("[inventory-metadata-error] reports the canonical Idea.md template", async () => {
  const repository = await fixture();
  const target = IDEAS[2];
  assert.ok(target);
  const documentPath =
    `.silvermoon/ideas/${target.id}/outer/inner/ideal/Idea.md`;
  const report = await listIdeas({
    metadataReader: async (root, idea) => {
      if (idea.id !== target.id) return readIdeaInventoryItem(root, idea);
      throw new IdeaMetadataReadError(
        idea.id,
        idea.worlds.idealRevision.documentPath,
        new Error("fixture read failure"),
      );
    },
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(report.response.kind, "blocked");
  assert.equal(report.observation.problems[0]?.type, "idea-metadata-unavailable");
  assert.equal(report.observation.problems[0]?.type, "idea-metadata-unavailable");
  assert.match(
    report.response.nextSteps[0]?.text ?? "",
    new RegExp(
      `Restore ${documentPath.replaceAll(".", "\\.")} as the current idea's canonical Idea.md`,
    ),
  );
  assert.match(
    report.response.nextSteps[0]?.text ?? "",
    /```markdown\n# <title>\n\n## Problem\n\n## Outcome\n\n## Boundaries\n\n## Acceptance criteria\n```/,
  );
});

test("[inventory-title-budget] reads only two titles for two active ideas out of 32", async () => {
  const ideas = Array.from({ length: 32 }, (_, index) => ({
    id: idAt(
      "2026-09-30T00:00:00.000Z",
      ALPHABET[index] ?? String(index),
    ),
    status: {},
  }));
  const repository = await createRepository({
    ideas,
    prefix: "silvermoon-list-budget-",
    withRemote: false,
  });
  temporaryDirectories.push(repository.base);
  const firstBudgetIdea = ideas.at(0);
  assert.ok(firstBudgetIdea);
  const firstPaths = ideaPaths(firstBudgetIdea.id);
  const revisions = {
    approvedRevision: git(
      repository.root,
      "rev-parse",
      `HEAD:${firstPaths.idealPath}`,
    ),
    implementationAcceptedRevision: git(
      repository.root,
      "rev-parse",
      `HEAD:${firstPaths.innerPath}`,
    ),
    deploymentAcceptedRevision: git(
      repository.root,
      "rev-parse",
      `HEAD:${firstPaths.outerPath}`,
    ),
  };
  for (const [index, idea] of ideas.entries()) {
    const status = index === 0
      ? { version: 1, id: idea.id }
      : index === 1
        ? {
            version: 1,
            id: idea.id,
            approvedRevision: revisions.approvedRevision,
          }
        : { version: 1, id: idea.id, ...revisions };
    await writeFile(
      join(repository.root, ...ideaPaths(idea.id).statusPath.split("/")),
      serializeIdeaStatus(status),
    );
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set 32 idea states");

  const reads: string[] = [];
  const tracePath = join(repository.base, "inventory-budget.trace.jsonl");
  const report = await withTraceFile(
    tracePath,
    "test.inventory-budget",
    {},
    () => listIdeas({
      metadataReader: async (...args: Parameters<typeof readIdeaInventoryItem>) => {
        const [root, idea] = args;
        reads.push(idea.id);
        return readIdeaInventoryItem(...args);
      },
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(report.observation.summary.matched, 2);
  assert.equal(report.observation.summary.returned, 2);
  assert.deepEqual(new Set(reads), new Set(ideas.slice(0, 2).map(({ id }) => id)));
  assert.equal(reads.length, 2);
  const events = (await readFile(tracePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const metadataEnd = events.find(
    ({ event, name }) =>
      event === "span-end" && name === "ideas.inventory-metadata",
  );
  assert.equal(metadataEnd.attributes.ideaCount, 32);
  assert.equal(metadataEnd.attributes.candidateCount, 2);
  assert.equal(metadataEnd.attributes.queryCandidateCount, 0);
  assert.equal(metadataEnd.attributes.titleReadCount, 2);
});

test("[inventory-language] overrides only this inventory report's output language", async () => {
  const repository = await fixture();
  const report = await listIdeas({
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.intention.args.language, "zh-CN");
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(report.response.language, "zh-CN");
  assert.equal(report.response.kind, "idea-list");
  assert.deepEqual(report.response.query, report.intention.args);
  assert.equal(report.response.summary, "匹配 3 个 idea，返回 3 个。");
});

test("[inventory-empty] returns a successful complete shape for an empty inventory", async () => {
  const repository = await createRepository({
    ideas: [],
    prefix: "silvermoon-list-empty-",
    withRemote: false,
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
  assert.equal(report.response.kind, "idea-list");
  assert.deepEqual(report.response.items, []);
});

test("[inventory-filters] combines all filters, time bounds, stable sorting, and limit", async () => {
  const repository = await fixture();
  const oldestOptions = {
    all: true,
    limit: 2,
    root: repository.root,
    userHome: repository.base,
  };
  Object.defineProperty(oldestOptions, "sort", {
    enumerable: true,
    value: "oldest",
  });
  const all = await listIdeas(oldestOptions);
  assert.equal(all.observation.state, "ideas-listed");
  assert.deepEqual(
    all.observation.ideas.map(({ id }: { id: string }) => id),
    IDEAS.slice(0, 2).map(({ id }) => id),
  );
  assert.equal(all.observation.summary.matched, 5);
  assert.equal(all.observation.summary.returned, 2);
  assert.ok("truncated" in all.observation.summary);
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
  assert.equal(filtered.observation.state, "ideas-listed");
  assert.deepEqual(
    filtered.observation.ideas.map(({ id }: { id: string }) => id),
    [ideaAt(1).id],
  );
  assert.equal(filtered.intention.args.createdSince, "2026-09-26T00:00:00.000Z");
  assert.equal(filtered.intention.args.createdBefore, "2026-09-27T00:00:00.000Z");
});

test("[inventory-worktree] includes staged, unstaged, and untracked idea content", async () => {
  const repository = await fixture();
  const existingIdea = ideaAt(0);
  const existingPath = ideaPaths(existingIdea.id).ideaDocumentPath;
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
  assert.equal(report.observation.state, "ideas-listed");
  const existing = report.observation.ideas.find(
    ({ id }: { id: string }) => id === existingIdea.id,
  );
  const added = report.observation.ideas.find(({ id }: { id: string }) => id === untrackedId);
  assert.ok(existing);
  assert.ok(added);
  assert.equal(existing.title, "Latest worktree title");
  assert.equal(existing.state, "preparing");
  assert.equal(added.alias, "untracked-idea");
  assert.equal(added.title, "Untracked idea");
  assert.equal(added.state, "preparing");
});

test("[inventory-readiness] ignores worktree, branch, upstream, ancestry, and network readiness", async () => {
  const repository = await fixture({ withUpstream: true });
  git(repository.root, "branch", "--unset-upstream");
  git(repository.root, "checkout", "--detach");
  await writeFile(join(repository.root, "dirty-untracked.txt"), "local only\n");
  const commands: (readonly string[])[] = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => listIdeas({ all: true, root: repository.root, userHome: repository.base }),
  );

  assert.equal(report.observation.state, "ideas-listed");
  assert.equal(report.observation.summary.matched, 5);
  assert.deepEqual(report.actions, []);
  assert.equal(
    commands.some(([subcommand]) =>
      subcommand !== undefined
      && ["fetch", "ls-remote", "status", "merge-base", "rev-list"].includes(
        subcommand,
      )
    ),
    false,
  );
});

test("[inventory-conflict] ignores an unrelated unresolved merge conflict", async () => {
  const repository = await fixture({ withRemote: true });
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
  const commands: (readonly string[])[] = [];
  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => listIdeas({ root: "missing", states: ["unknown"] }),
    ),
    (caught) =>
      caught instanceof Error
      && "exitCode" in caught
      && caught.exitCode === 2,
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
  assert.match(
    output.errors.at(0) ?? "",
    /query must be a non-empty string/,
  );
  await assert.rejects(access(trace), { code: "ENOENT" });
});

test("[inventory-layout] fails explicitly on invalid layout even when filters would hide it", async () => {
  const repository = await fixture();
  const hidden = ideaPaths(ideaAt(4).id);
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
      ({ type }: { type: string }) => type === "idea-ledger-missing-file",
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
  assert.equal(JSON.parse(firstLog(output)).response.kind, "blocked");
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
  const report = JSON.parse(firstLog(json));
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
  const rendered = firstLog(text);
  assert.match(rendered, /^## Ideas/);
  assert.match(rendered, /Matched 3 idea\(s\) and returned 3\./);
  assert.match(
    rendered,
    /Counts: preparing=1, implementing=1, deploying=1\./,
  );
  assert.doesNotMatch(rendered, /completed=0|abandoned=0/);
  assert.match(rendered, /\| Alias \/ ID \| State \| Created \| Title \|/);
  assert.match(rendered, /\| alpha \| preparing \| .* \| Alpha inventory \|/);
  assert.match(rendered, new RegExp(`\\| ${ideaAt(2).id} \\| deploying \\|`));
  assert.doesNotMatch(rendered, /2026-09-25T00:00:00/);
  assert.doesNotMatch(
    rendered,
    /^## Next steps\b|`(?:silvermoon )?(?:create-idea|whats-next)\b/m,
  );
  assert.deepEqual(text.errors, []);
});
