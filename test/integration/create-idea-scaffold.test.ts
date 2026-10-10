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

import { createIdea } from "../../src/business/create-idea.ts";
import { observeGitCommands } from "../../src/foundation/git/index.ts";
import {
  DEPLOYMENT_TEMPLATE,
  IDEA_TEMPLATE,
  IMPLEMENTATION_TEMPLATE,
  LEDGER_TEMPLATE,
  ideaTemplates,
} from "../../src/foundation/idea-template/index.ts";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/foundation/coordinates/index.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import {
  createRepository,
  FIRST_ID,
  git,
} from "../helpers/repository.ts";
import { createCreateIdeaTestHelpers } from "../helpers/create-idea.ts";

const {
  fixture,
  pushPeerChange,
  repositoryState,
} = createCreateIdeaTestHelpers(afterEach);
const createdId = "01M38K00000000000000000001";
const secondId = "01M38K00000000000000000002";

function responseText(report: Awaited<ReturnType<typeof createIdea>>) {
  return "nextSteps" in report.response
    ? report.response.nextSteps?.map(({ text }) => text).join("\n") ?? ""
    : "";
}

function actionCreatedIdeaId(
  action: Awaited<ReturnType<typeof createIdea>>["actions"][number] | undefined,
) {
  assert.ok(action);
  assert.equal(action.status, "success");
  assert.ok("result" in action);
  assert.ok("createdIdea" in action.result);
  const { createdIdea } = action.result;
  assert.ok(
    createdIdea !== null
    && typeof createdIdea === "object"
    && "id" in createdIdea,
  );
  return createdIdea.id;
}

test("project setup reports no idea inventory and performs no repository access", async () => {
  const repository = await fixture();
  await rm(join(repository.root, ".silvermoon", "config.yaml"));
  const commands: (readonly string[])[] = [];

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
  assert.equal(report.observation.observedThrough, "version");
  assert.equal(
    commands.some(([name]) =>
      name !== undefined
      && ["fetch", "ls-remote", "status", "symbolic-ref"].includes(name)
    ),
    false,
  );
});

test("package metadata does not block idea creation", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, "package.json"),
    JSON.stringify({ name: "consumer" }, null, 2) + "\n",
  );
  git(repository.root, "add", "package.json");
  git(repository.root, "commit", "-m", "Add package metadata");
  git(repository.root, "push", "origin", "main");
  const commands: (readonly string[])[] = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "idea-created");
  assert.deepEqual(report.observation.problems, []);
  assert.equal(report.actions.length, 1);
  assert.equal(commands.some(([name]) => name === "fetch"), false);
  assert.deepEqual(
    await readdir(join(repository.root, ".silvermoon", "ideas")),
    [FIRST_ID, createdId],
  );
});

test("[unrelated-active-create] [create-no-remote] creates an exact scaffold without remote access", async () => {
  const repository = await fixture();
  assert.ok(repository.repository);
  const before = repositoryState(repository.root, repository.repository);
  const commands: (readonly string[])[] = [];

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
    report.actions.map(({ type, status }: { type: string; status: string }) => [type, status]),
    [["create-idea-scaffold", "success"]],
  );
  assert.equal(actionCreatedIdeaId(report.actions.at(0)), createdId);
  assert.match(responseText(report), new RegExp(ideaPaths(createdId).ideaDocumentPath));
  assert.match(responseText(report), /en-US/);
  assert.match(responseText(report), /lightweight first versions/);
  assert.match(responseText(report), /Idea acceptance covers only/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
  assert.match(IMPLEMENTATION_TEMPLATE, /lightweight first\s+version/);
  assert.match(DEPLOYMENT_TEMPLATE, /lightweight first\s+version/);
  assert.match(LEDGER_TEMPLATE, /mirror the lightweight contract versions/);

  const paths = ideaPaths(createdId);
  const expectedFiles: Array<[string, string]> = [
    [paths.ideaDocumentPath, IDEA_TEMPLATE],
    [paths.implementationDocumentPath, IMPLEMENTATION_TEMPLATE],
    [paths.deploymentDocumentPath, DEPLOYMENT_TEMPLATE],
    [paths.ledgerPath, LEDGER_TEMPLATE],
  ];
  for (const [path, source] of expectedFiles) {
    assert.equal(await readFile(join(repository.root, ...path.split("/")), "utf8"), source);
  }
  assert.equal(
    await readFile(join(repository.root, ...paths.eventsPath.split("/")), "utf8"),
    "",
  );
  const after = repositoryState(repository.root, repository.repository);
  assert.deepEqual(after, before);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.equal(
    commands.some(([name]) =>
      name !== undefined && ["commit", "push"].includes(name)
    ),
    false,
  );
  const readinessCommands = commands.filter((args) =>
    args[0] !== undefined
    && ["config", "status", "symbolic-ref"].includes(args[0])
    || (args[0] === "rev-parse" && args[1] === "--verify")
  );
  assert.deepEqual(
    readinessCommands.map(([name]) => name),
    ["status", "config"],
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

  assert.equal(report.actions.at(-1)?.status, "success");
  assert.equal(
    await readFile(
      join(repository.root, ...ideaPaths(createdId).eventsPath.split("/")),
      "utf8",
    ),
    "",
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
  assert.equal(report.actions.at(-1)?.status, "success");
  await readFile(
    join(repository.root, ...ideaPaths(createdId).eventsPath.split("/")),
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
  assert.ok(report.observation.configuration);
  assert.equal(
    report.observation.configuration.preferredLanguage,
    "zh-CN",
  );
  assert.match(responseText(report), /构想契约/);
  assert.match(responseText(report), /轻量初版/);
  assert.match(responseText(report), /构想验收只覆盖/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
  const paths = ideaPaths(createdId);
  const templates = ideaTemplates("zh-CN");
  const localizedFiles: Array<[string, string]> = [
    [paths.ideaDocumentPath, templates.idea],
    [paths.implementationDocumentPath, templates.implementation],
    [paths.deploymentDocumentPath, templates.deployment],
    [paths.ledgerPath, templates.ledger],
  ];
  for (const [path, source] of localizedFiles) {
    assert.equal(
      await readFile(join(repository.root, ...path.split("/")), "utf8"),
      source,
    );
    assert.doesNotMatch(source, /Step title|Criterion title/);
  }
  assert.equal(
    await readFile(
      join(repository.root, ...paths.eventsPath.split("/")),
      "utf8",
    ),
    serializeIdeaEvents([{
      sequence: 1,
      type: "setLanguage",
      payload: { language: "zh-CN" },
    }]),
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
  assert.ok(report.observation.configuration);
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
      join(repository.root, ...ideaPaths(createdId).eventsPath.split("/")),
      "utf8",
    ),
    serializeIdeaEvents([{
      sequence: 1,
      type: "setLanguage",
      payload: { language: "fr-FR" },
    }]),
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
  assert.match(
    responseText(report),
    /silvermoon create-idea --audience agent/,
  );
  assert.doesNotMatch(responseText(report), /--json/);
  assert.equal(
    git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"),
    before,
  );
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(createdId).eventsPath.split("/")),
    ),
    { code: "ENOENT" },
  );
});

test("[ulid-collision] retries without changing the colliding idea", async () => {
  const repository = await fixture();
  const existingStatus = join(
    repository.root,
    ...ideaPaths(FIRST_ID).eventsPath.split("/"),
  );
  const original = await readFile(existingStatus, "utf8");
  const ids = [FIRST_ID, secondId];

  const report = await createIdea({
    generateId: () => {
      const next = ids.shift();
      assert.ok(next);
      return next;
    },
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.actions.at(-1)?.status, "success");
  assert.equal(actionCreatedIdeaId(report.actions.at(-1)), secondId);
  assert.equal(await readFile(existingStatus, "utf8"), original);
});
