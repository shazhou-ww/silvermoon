import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  readdir,
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
  ideaTemplates,
} from "../../src/idea-templates.js";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/layout.js";
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

function responseText(report) {
  return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
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

test("npm dependency setup blocks idea creation before repository synchronization", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, "package.json"),
    JSON.stringify({ name: "consumer" }, null, 2) + "\n",
  );
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
  assert.equal(report.observation.problems[0].type, "npm-dependency-missing");
  assert.equal(report.actions.length, 0);
  assert.equal(commands.some(([name]) => name === "fetch"), false);
  assert.deepEqual(
    await readdir(join(repository.root, ".silvermoon", "ideas")),
    [FIRST_ID],
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
    "actions",
    "intention",
    "observation",
    "response",
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
  assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  assert.deepEqual(
    report.actions.map(({ type, status }) => [type, status]),
    [["create-idea-scaffold", "success"]],
  );
  assert.equal(report.actions[0].result.createdIdea.id, createdId);
  assert.match(responseText(report), new RegExp(ideaPaths(createdId).ideaDocumentPath));
  assert.match(responseText(report), /en-US/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);

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

  assert.equal(report.actions.at(-1).status, "success");
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
  assert.equal(report.actions.at(-1).status, "success");
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
  assert.match(responseText(report), /理想契约/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
  const paths = ideaPaths(createdId);
  const templates = ideaTemplates("zh-CN");
  for (const [path, source] of [
    [paths.ideaDocumentPath, templates.idea],
    [paths.implementationDocumentPath, templates.implementation],
    [paths.deploymentDocumentPath, templates.deployment],
    [paths.ledgerPath, templates.ledger],
  ]) {
    assert.equal(
      await readFile(join(repository.root, ...path.split("/")), "utf8"),
      source,
    );
    assert.doesNotMatch(source, /Step title|Criterion title/);
  }
  assert.equal(
    await readFile(
      join(repository.root, ...paths.statusPath.split("/")),
      "utf8",
    ),
    `version: 1\nid: ${createdId}\nlanguage: zh-CN\n`,
  );
});

test("keeps arbitrary canonical content languages outside the output allowlist", async () => {
  const repository = await fixture();

  const report = await createIdea({
    generateId: () => createdId,
    language: "fr-fr",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.intention.args.language, "fr-FR");
  assert.equal(
    report.observation.configuration.preferredLanguage,
    "fr-FR",
  );
  assert.equal(report.observation.outputLanguage, "en-US");
  assert.match(
    responseText(report),
    /no built-in fr-FR scaffold.*en-US fallback placeholders/,
  );
  assert.match(
    responseText(report),
    /Replace all natural-language placeholders with fr-FR/,
  );
  assert.equal(
    await readFile(
      join(repository.root, ...ideaPaths(createdId).statusPath.split("/")),
      "utf8",
    ),
    `version: 1\nid: ${createdId}\nlanguage: fr-FR\n`,
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
  assert.deepEqual(report.actions, []);
  assert.match(responseText(report), /silvermoon create-idea/);
  assert.doesNotMatch(responseText(report), /--json/);
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

  assert.equal(report.actions.at(-1).status, "success");
  assert.equal(report.actions.at(-1).result.createdIdea.id, secondId);
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

  assert.deepEqual(
    report.actions.map(({ type, status }) => [type, status]),
    [
      ["create-idea-scaffold", "failure"],
      ["remove-owned-creation-paths", "success"],
    ],
  );
  assert.equal(report.observation.state, "idea-create-failed");
  assert.equal(Object.hasOwn(report.observation, "createdIdea"), false);
  assert.match(report.actions[0].problem.summary, /injected write failure/);
  assert.equal(report.actions[1].result.preserved, 0);
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

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.ok(report.actions[1].result.preserved > 0);
  assert.match(report.response.problems[0].summary, /Preserved [1-9]\d* path/);
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

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.match(report.actions[0].problem.summary, /injected access failure/);
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

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.ok(report.actions[1].result.preserved > 0);
  assert.match(report.response.problems[0].summary, /Preserved [1-9]\d* path/);
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

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.match(report.actions[0].problem.summary, /canonical ULID/);
  assert.equal(
    spawnSync(
      "git",
      ["-C", repository.root, "status", "--porcelain=v1"],
      { encoding: "utf8", windowsHide: true },
    ).stdout,
    before,
  );
});

test("attaches preparing guidance before creating a scaffold", async () => {
  const repository = await fixture();
  const preparingPath = phaseGuidancePath("preparing");
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...preparingPath.split("/")),
    "Prepare this project-specific contract.\n",
  );
  await mkdir(
    join(repository.root, ...phaseGuidancePath("implementing").split("/")),
  );
  await writeFile(
    join(
      repository.root,
      ...phaseGuidancePath("implementing").split("/"),
      "invalid.md",
    ),
    "ignored\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add preparing guidance");

  const report = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-created");
  assert.deepEqual(report.observation.guidance, {
    phase: "preparing",
    path: preparingPath,
    contentRevision: git(repository.root, "rev-parse", `HEAD:${preparingPath}`),
  });
  assert.equal(
    report.response.guidance.content,
    "Prepare this project-specific contract.\n",
  );
  assert.match(responseText(report), /Ideal World/);
  assert.doesNotMatch(responseText(report), /project-specific contract/);
});

test("invalid preparing guidance stops before any scaffold write", async () => {
  const repository = await fixture();
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...phaseGuidancePath("preparing").split("/")),
    " \n\t\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add invalid preparing guidance");
  const ideasBefore = await readdir(join(repository.root, ".silvermoon", "ideas"));
  let directoryWrites = 0;

  const report = await createIdea({
    generateId: () => createdId,
    operations: {
      mkdir: async (...args) => {
        directoryWrites += 1;
        return mkdir(...args);
      },
    },
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "phase-guidance-invalid");
  assert.deepEqual(
    report.observation.problems.map(({ type }) => type),
    ["guidance-file-empty"],
  );
  assert.equal(report.actions.length, 0);
  assert.equal(directoryWrites, 0);
  assert.deepEqual(
    await readdir(join(repository.root, ".silvermoon", "ideas")),
    ideasBefore,
  );
  assert.doesNotMatch(responseText(report), /Ideal World/);
  assert.match(responseText(report), /preparing\.md/);
});

test("does not inspect preparing guidance before creation preflight succeeds", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "dirty.txt"), "preserve\n");
  let reads = 0;

  const report = await createIdea({
    generateId: () => createdId,
    guidanceReader: async () => {
      reads += 1;
      throw new Error("guidance must not be read");
    },
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-preparation-required");
  assert.equal(reads, 0);
});
