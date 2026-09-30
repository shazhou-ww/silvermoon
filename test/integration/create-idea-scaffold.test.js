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
import { createCreateIdeaTestHelpers } from "../helpers/create-idea.js";

const {
  fixture,
  pushPeerChange,
  repositoryState,
  responseText,
} = createCreateIdeaTestHelpers(afterEach);
const createdId = "01M38K00000000000000000001";
const secondId = "01M38K00000000000000000002";

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
