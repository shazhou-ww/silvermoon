import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeGitCommands } from "../../src/git.js";
import { inspectPhaseGuidance } from "../../src/guidance.js";
import { ideaCreatedAt } from "../../src/idea-query.js";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/layout.js";
import {
  CHANGE_SAMPLE_ITEM_LIMIT,
  whatsNext,
} from "../../src/whatsnext.js";
import { renderResponse } from "../../src/response.js";
import {
  createRepository,
  FIRST_ID,
  git,
  PRIMARY_REPOSITORY,
  SECOND_ID,
  setIdeaState,
} from "../helpers/repository.js";
import { createWhatsNextTestHelpers } from "../helpers/whatsnext.js";

const {
  envelopeKeys,
  fixture,
  pushPeerChange,
  responseText,
  trackTemporaryDirectory,
} = createWhatsNextTestHelpers(afterEach);
const DEPLOYING_ID = "01M36QGPNTXEPP61DA4KP4AVG1";
const COMPLETED_ID = "01M36QGPNTXEPP61DA4KP4AVG2";
const ABANDONED_ID = "01M36QGPNTXEPP61DA4KP4AVG3";

test("project setup uses cumulative observation variants and reports all setup fixes", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-unconfigured-"));
  trackTemporaryDirectory(root);

  const missingGit = await whatsNext({
    language: "zh-cn",
    root,
    userHome: root,
  });
  assert.equal(missingGit.observation.state, "project-setup-required");
  assert.equal(missingGit.observation.observedThrough, "root");
  assert.equal(missingGit.intention.args.language, "zh-CN");
  assert.equal(missingGit.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(missingGit.observation, "version"), false);
  assert.deepEqual(
    missingGit.observation.problems.map(({ type }) => type),
    ["git-repository-missing", "config-missing", "canonical-skill-missing"],
  );
  assert.equal(missingGit.actions.length, 0);
  assert.match(responseText(missingGit), /^1\. .*\n2\. .*\n3\. /);
  assert.match(responseText(missingGit), /处理/);

  const configured = await fixture();
  await writeFile(
    join(configured.root, ".silvermoon", "config.yaml"),
    `version: 2
primaryRepository: ${PRIMARY_REPOSITORY}
primaryBranch: main
`,
  );
  git(configured.root, "add", ".");
  git(configured.root, "commit", "-m", "Break configuration");
  const invalidConfig = await whatsNext({
    root: configured.root,
    userHome: configured.base,
  });
  assert.equal(invalidConfig.observation.observedThrough, "version");
  assert.deepEqual(invalidConfig.observation.version, { type: "worktree" });
  assert.equal(
    Object.hasOwn(invalidConfig.observation, "configuration"),
    false,
  );
  assert.ok(
    invalidConfig.observation.problems.some(
      ({ type }) => type === "config-unsupported-version",
    ),
  );

  const missingSkill = await fixture({ preferredLanguage: "zh-CN" });
  await rm(join(missingSkill.root, ".agents"), { recursive: true });
  git(missingSkill.root, "add", "--all");
  git(missingSkill.root, "commit", "-m", "Remove canonical skill");
  const observedIdeas = await whatsNext({
    root: missingSkill.root,
    userHome: missingSkill.base,
  });
  assert.equal(observedIdeas.observation.observedThrough, "ideas");
  assert.equal(observedIdeas.observation.ideas.counts.preparing, 1);
  assert.equal(
    observedIdeas.observation.problems[0].type,
    "canonical-skill-missing",
  );
  assert.match(observedIdeas.observation.problems[0].summary, /^Silvermoon 发现/);
  assert.match(responseText(observedIdeas), /^处理/);
  assert.doesNotMatch(responseText(observedIdeas), /^\d+\. /m);
});

test("npm dependency setup blocks lifecycle navigation before fetching primary", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, "package.json"),
    JSON.stringify({ name: "consumer" }, null, 2) + "\n",
  );
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(report.observation.problems[0].type, "npm-dependency-missing");
  assert.equal(report.actions.length, 0);
  assert.match(responseText(report), /silvermoon@\^[0-9]+\.[0-9]+\.[0-9]+/);
  assert.equal(commands.some(([name]) => name === "fetch"), false);
});

test("[selector-none] naked navigation lists one active idea without selecting it", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(envelopeKeys(report), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.deepEqual(report.intention, {
    command: "whats-next",
    args: { idea: null, language: null },
  });
  assert.equal(report.observation.outputLanguage, "en-US");
  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
    alias: "fixture",
    title: "Fixture",
  }]);
  assert.equal(
    report.response.summary,
    "Current state: navigation-ready. 1 active idea(s) are available.",
  );
  assert.deepEqual(report.response.choices, report.observation.ideas.activeIdeas);
  const rendered = renderResponse(report.response);
  assert.match(rendered, /### Active ideas/);
  assert.match(rendered, /\| Alias \/ ID \| State \| Created \| Title \|/);
  assert.match(
    rendered,
    /\| fixture \| preparing \| .* \| Fixture \|/,
  );
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /silvermoon whats-next <ULID-or-alias>/);
  assert.match(responseText(report), /silvermoon create-idea/);
  assert.equal(report.actions[0].type, "fetch-primary");
  assert.equal(report.actions[0].status, "success");

  const localized = await whatsNext({
    language: "zh-cn",
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(localized.observation.state, "navigation-ready");
  assert.equal(localized.observation.outputLanguage, "zh-CN");
  assert.equal(
    localized.response.summary,
    "当前状态：navigation-ready。当前有 1 个 active idea。",
  );
  assert.equal(
    localized.observation.configuration.preferredLanguage,
    "en-US",
  );
  assert.match(responseText(localized), /^请明确选择/);
  assert.match(localized.actions[0].result.commit, /^[0-9a-f]{40}$/);
  assert.equal(Object.hasOwn(localized.actions[0], "summary"), false);
});

test("empty navigation stays ready without selecting an idea", async () => {
  const repository = await fixture({ ideas: [] });
  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, []);
  assert.equal(report.observation.ideas.counts.completed, 0);
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(renderResponse(report.response), /当前没有 active idea|No active ideas/);
  assert.match(responseText(report), /create-idea/);
});

test("navigation renders an alias-less idea without a level-one title", async () => {
  const repository = await fixture({
    ideas: [{ id: FIRST_ID, status: {} }],
  });
  const path = ideaPaths(FIRST_ID).ideaDocumentPath;
  await writeFile(join(repository.root, ...path.split("/")), "## Not a title\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Remove level-one title");
  git(repository.root, "push", "origin", "main");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });
  assert.deepEqual(report.response.choices, [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
  }]);
  assert.match(
    renderResponse(report.response, {
      now: new Date(Date.parse(ideaCreatedAt(FIRST_ID)) + 7 * 24 * 60 * 60_000),
    }),
    new RegExp(`\\| ${FIRST_ID} \\| preparing \\| 7d ago \\| - \\|`),
  );
});

test("resolves the repository root when invoked from a nested directory", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: nested,
    userHome: repository.base,
  });

  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.observation.selectedIdea.state, "preparing");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  assert.match(responseText(report), /approvedRevision/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
});
