import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { createIdea } from "../../src/create-idea.js";
import { observeGitCommands } from "../../src/git.js";
import {
  DEPLOYMENT_TEMPLATE,
  IDEA_TEMPLATE,
  IMPLEMENTATION_TEMPLATE,
  LEDGER_TEMPLATE,
} from "../../src/idea-templates.js";
import { ideaPaths } from "../../src/layout.js";
import {
  createRepository,
  FIRST_ID,
  git,
} from "../helpers/repository.js";

const temporaryDirectories = [];
const createdId = "01M38K00000000000000000001";
const secondId = "01M38K00000000000000000002";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function fixture(options) {
  const repository = await createRepository({
    prefix: "silvermoon-create-",
    ...options,
  });
  temporaryDirectories.push(repository.base);
  return repository;
}

function repositoryState(root, repository) {
  return {
    head: git(root, "rev-parse", "HEAD"),
    index: git(root, "write-tree"),
    localRefs: git(root, "for-each-ref", "--format=%(refname) %(objectname)"),
    remoteRefs: git(root, "ls-remote", repository),
  };
}

async function pushPeerChange(repository) {
  const peer = join(repository.base, "peer");
  const cloned = spawnSync("git", ["clone", repository.remote, peer], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(cloned.status, 0, cloned.stderr);
  git(peer, "config", "user.name", "silvermoon peer");
  git(peer, "config", "user.email", "silvermoon@example.invalid");
  await writeFile(join(peer, "peer.txt"), "peer\n");
  git(peer, "add", ".");
  git(peer, "commit", "-m", "Move primary concurrently");
  git(peer, "push", "origin", "main");
}

test("project setup reports no idea inventory and performs no repository access", async () => {
  const repository = await fixture();
  await rm(join(repository.root, ".agents"), { recursive: true });
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.equal(report.observation.observedThrough, "configuration");
  assert.equal(
    commands.some(([name]) =>
      ["fetch", "ls-remote", "status", "symbolic-ref"].includes(name)
    ),
    false,
  );
});

test("[unrelated-active-create] [create-no-remote] creates an exact scaffold without remote access", async () => {
  const repository = await fixture();
  const before = repositoryState(repository.root, repository.repository);
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.deepEqual(Object.keys(report).sort(), [
    "instructions",
    "intention",
    "observation",
    "outcomes",
  ]);
  assert.deepEqual(report.intention, {
    command: "create-idea",
    args: { language: null },
  });
  assert.equal(report.observation.state, "idea-created");
  assert.deepEqual(report.observation.createdIdea, {
    id: createdId,
    path: ideaPaths(createdId).ideaPath,
    state: "preparing",
  });
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.deepEqual(
    report.outcomes.map(({ type, status }) => [type, status]),
    [["create-idea-scaffold", "success"]],
  );
  assert.match(report.outcomes[0].summary, new RegExp(createdId));
  assert.match(report.instructions, new RegExp(ideaPaths(createdId).ideaDocumentPath));
  assert.match(report.instructions, /en-US/);
  assert.doesNotMatch(report.instructions, /道心|内景|现世/);

  const paths = ideaPaths(createdId);
  for (const [path, source] of [
    [paths.ideaDocumentPath, IDEA_TEMPLATE],
    [paths.implementationDocumentPath, IMPLEMENTATION_TEMPLATE],
    [paths.deploymentDocumentPath, DEPLOYMENT_TEMPLATE],
    [paths.ledgerPath, LEDGER_TEMPLATE],
  ]) {
    assert.equal(await readFile(join(repository.root, ...path.split("/")), "utf8"), source);
  }
  assert.equal(
    await readFile(join(repository.root, ...paths.statusPath.split("/")), "utf8"),
    `version: 1\nid: ${createdId}\n`,
  );
  const after = repositoryState(repository.root, repository.repository);
  assert.deepEqual(after, before);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.equal(
    commands.some(([name]) => ["commit", "push"].includes(name)),
    false,
  );
});

test("creates the first idea when the ideas directory does not yet exist", async () => {
  const repository = await fixture({ ideas: [] });
  await rm(join(repository.root, ".silvermoon", "ideas"), {
    recursive: true,
  });

  const report = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "success");
  assert.equal(
    await readFile(
      join(repository.root, ...ideaPaths(createdId).statusPath.split("/")),
      "utf8",
    ),
    `version: 1\nid: ${createdId}\n`,
  );
});

test("creates at the Git root when invoked from a nested directory", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });

  const report = await createIdea({
    generateId: () => createdId,
    root: nested,
    userHome: repository.base,
  });

  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.equal(report.outcomes.at(-1).status, "success");
  await readFile(
    join(repository.root, ...ideaPaths(createdId).statusPath.split("/")),
    "utf8",
  );
});

test("normalizes and persists an explicit idea language", async () => {
  const repository = await fixture();

  const report = await createIdea({
    generateId: () => createdId,
    language: "zh-cn",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.intention.args.language, "zh-CN");
  assert.equal(
    report.observation.configuration.preferredLanguage,
    "zh-CN",
  );
  assert.match(report.instructions, /理想契约/);
  assert.doesNotMatch(report.instructions, /道心|内景|现世/);
  assert.equal(
    await readFile(
      join(repository.root, ...ideaPaths(createdId).statusPath.split("/")),
      "utf8",
    ),
    `version: 1\nid: ${createdId}\nlanguage: zh-CN\n`,
  );
});

test("preserves create intent and does not mutate a dirty repository", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "dirty.txt"), "preserve\n");
  const before = git(
    repository.root,
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  );

  const report = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-preparation-required");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.deepEqual(report.outcomes, []);
  assert.match(report.instructions, /silvermoon create-idea/);
  assert.doesNotMatch(report.instructions, /--json/);
  assert.equal(
    git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"),
    before,
  );
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(createdId).statusPath.split("/")),
    ),
    { code: "ENOENT" },
  );
});

test("[ulid-collision] retries without changing the colliding idea", async () => {
  const repository = await fixture();
  const existingStatus = join(
    repository.root,
    ...ideaPaths(FIRST_ID).statusPath.split("/"),
  );
  const original = await readFile(existingStatus, "utf8");
  const ids = [FIRST_ID, secondId];

  const report = await createIdea({
    generateId: () => ids.shift(),
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "success");
  assert.match(report.outcomes.at(-1).summary, new RegExp(secondId));
  assert.equal(await readFile(existingStatus, "utf8"), original);
});

test("creates while local primary is ahead, behind, or diverged", async () => {
  for (const relation of ["ahead", "behind", "diverged"]) {
    const repository = await fixture({ prefix: `silvermoon-create-${relation}-` });
    if (relation !== "behind") {
      await writeFile(join(repository.root, `${relation}-local.txt`), "local\n");
      git(repository.root, "add", ".");
      git(repository.root, "commit", "-m", `Create ${relation} local commit`);
    }
    if (relation !== "ahead") {
      await pushPeerChange(repository);
    }

    const commands = [];
    const report = await observeGitCommands(
      (args) => commands.push(args),
      () => createIdea({
        generateId: () => relation === "ahead" ? createdId : secondId,
        root: repository.root,
        userHome: repository.base,
      }),
    );

    assert.equal(report.observation.state, "idea-created", relation);
    assert.equal(
      commands.some(([name]) => name === "fetch" || name === "ls-remote"),
      false,
      relation,
    );
  }
});

test("[create-primary-branch] [create-primary-upstream] requires configured primary coordinates", async () => {
  const repository = await fixture();
  git(repository.root, "checkout", "-b", "feature");
  git(repository.root, "branch", "--set-upstream-to=origin/main", "feature");

  const branchMismatch = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(branchMismatch.observation.state, "repository-preparation-required");
  assert.equal(
    branchMismatch.observation.problems[0].type,
    "primary-branch-mismatch",
  );

  git(repository.root, "checkout", "main");
  git(repository.root, "branch", "--unset-upstream");
  const upstreamMismatch = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(
    upstreamMismatch.observation.problems[0].type,
    "primary-upstream-mismatch",
  );
});

test("[partial-write-failure] cleans up operation-owned partial files", async () => {
  const repository = await fixture();
  let writes = 0;
  const operations = {
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 3) {
        const error = new Error("injected write failure");
        error.code = "EIO";
        throw error;
      }
      return writeFile(...args);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).type, "create-idea-scaffold");
  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.equal(report.observation.state, "idea-create-failed");
  assert.equal(Object.hasOwn(report.observation, "createdIdea"), false);
  assert.match(report.outcomes.at(-1).summary, /injected write failure/);
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(createdId).ideaDocumentPath.split("/")),
    ),
    { code: "ENOENT" },
  );
  assert.equal(
    git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"),
    "",
  );
});

test("preserves a concurrently modified created file and reports incomplete cleanup", async () => {
  const repository = await fixture();
  const paths = ideaPaths(createdId);
  const ideaDocument = join(
    repository.root,
    ...paths.ideaDocumentPath.split("/"),
  );
  let writes = 0;
  const operations = {
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 2) {
        await writeFile(ideaDocument, IDEA_TEMPLATE.slice(0, 12));
        const error = new Error("injected concurrent failure");
        error.code = "EIO";
        throw error;
      }
      return writeFile(...args);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.match(report.outcomes.at(-1).summary, /Preserved [1-9]\d* path/);
  assert.equal(await readFile(ideaDocument, "utf8"), IDEA_TEMPLATE.slice(0, 12));
});

test("returns an envelope when candidate inspection fails", async () => {
  const repository = await fixture();
  const operations = {
    lstat: async (path) => {
      if (path.endsWith(createdId)) {
        const error = new Error("injected access failure");
        error.code = "EACCES";
        throw error;
      }
      return lstat(path);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.match(report.outcomes.at(-1).summary, /injected access failure/);
});

test("does not retry after a concurrent file collision leaves another writer's path", async () => {
  const repository = await fixture();
  const paths = ideaPaths(createdId);
  let writes = 0;
  const operations = {
    writeFile: async (path, source, options) => {
      writes += 1;
      if (writes === 2) {
        await writeFile(path, "concurrent\n", { flag: "wx" });
        return writeFile(path, source, options);
      }
      return writeFile(path, source, options);
    },
  };

  const report = await createIdea({
    generateId: () => writes < 3 ? createdId : secondId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.match(report.outcomes.at(-1).summary, /Preserved [1-9]\d* path/);
  assert.equal(
    await readFile(
      join(repository.root, ...paths.implementationDocumentPath.split("/")),
      "utf8",
    ),
    "concurrent\n",
  );
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(secondId).statusPath.split("/")),
    ),
    { code: "ENOENT" },
  );
});

test("returns a failure outcome for an invalid generated identity", async () => {
  const repository = await fixture();
  const before = spawnSync(
    "git",
    ["-C", repository.root, "status", "--porcelain=v1"],
    { encoding: "utf8", windowsHide: true },
  ).stdout;

  const report = await createIdea({
    generateId: () => "invalid",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.match(report.outcomes.at(-1).summary, /canonical ULID/);
  assert.equal(
    spawnSync(
      "git",
      ["-C", repository.root, "status", "--porcelain=v1"],
      { encoding: "utf8", windowsHide: true },
    ).stdout,
    before,
  );
});
