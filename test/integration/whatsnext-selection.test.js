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

test("default navigation excludes completed and abandoned ideas while counting them", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set lifecycle states");
  git(repository.root, "push", "origin", "main");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.ideas.counts, {
    preparing: 1,
    implementing: 1,
    deploying: 1,
    completed: 1,
    abandoned: 1,
  });
  assert.deepEqual(
    report.observation.ideas.activeIdeas.map(({ id }) => id),
    [FIRST_ID, SECOND_ID, DEPLOYING_ID].sort(),
  );
  assert.doesNotMatch(responseText(report), new RegExp(COMPLETED_ID));
  assert.doesNotMatch(responseText(report), new RegExp(ABANDONED_ID));

  for (const [id, phrase] of [
    [FIRST_ID, "approvedRevision"],
    [SECOND_ID, "implementationAcceptedRevision"],
    [DEPLOYING_ID, "deploymentAcceptedRevision"],
    [COMPLETED_ID, "completed idea"],
    [ABANDONED_ID, "abandoned idea"],
  ]) {
    const selected = await whatsNext({
      idea: id,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.idea, id);
    assert.equal(selected.observation.state, "idea-selected");
    assert.equal(selected.observation.selectedIdea.id, id);
    assert.equal(Object.hasOwn(selected.observation, "ideas"), false);
    assert.match(responseText(selected), new RegExp(phrase));
  }
});

test("uses formal world and contract names in localized lifecycle instructions", async () => {
  const repository = await fixture({
    preferredLanguage: "fr-FR",
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set localized lifecycle states");
  git(repository.root, "push", "origin", "main");

  for (const [id, phrase] of [
    [FIRST_ID, "理想契约就绪"],
    [SECOND_ID, "除非理想契约确实需要变化"],
    [DEPLOYING_ID, "保留内层世界"],
    [COMPLETED_ID, "已完成 idea"],
    [ABANDONED_ID, "已放弃 idea"],
  ]) {
    const selected = await whatsNext({
      idea: id,
      language: "zh-cn",
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.language, "zh-CN");
    assert.equal(selected.observation.outputLanguage, "zh-CN");
    assert.equal(
      selected.observation.configuration.preferredLanguage,
      "fr-FR",
    );
    assert.match(responseText(selected), new RegExp(phrase));
    assert.doesNotMatch(responseText(selected), /道心|内景|现世/);
    if ([FIRST_ID, SECOND_ID, DEPLOYING_ID].includes(id)) {
      assert.match(
        responseText(selected),
        /自然语言内容中使用 fr-FR/,
      );
    }
  }
});

test("[selector-unknown] reports an unknown selector without guessing", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    idea: "unknown",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.problems, []);
  assert.equal(report.observation.state, "idea-not-found");
  assert.deepEqual(report.observation.candidates, [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
    alias: "fixture",
    title: "Fixture",
  }]);
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(responseText(report), /未匹配/);
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /create-idea/);
});

test("[selector-known] [alias-absent] selects an alias-less idea only by explicit ULID", async () => {
  const repository = await fixture({
    ideas: [{ id: FIRST_ID, status: {} }],
  });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(
    Object.hasOwn(report.observation.selectedIdea, "alias"),
    false,
  );
  assert.match(responseText(report), new RegExp(FIRST_ID));
  assert.doesNotMatch(responseText(report), /undefined|\(\)/);
});

test("resolves preferred language for the selected idea without changing bare navigation", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr" },
    }],
  });

  const selected = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  const bare = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(
    selected.observation.configuration.preferredLanguage,
    "fr",
  );
  assert.equal(selected.observation.outputLanguage, "en-US");
  assert.equal(
    bare.observation.configuration.preferredLanguage,
    "en-US",
  );
  assert.equal(bare.observation.outputLanguage, "en-US");
});

test("uses a canonical output override without changing content language or persisted status", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr-FR" },
    }],
  });
  const statusPath = join(
    repository.root,
    ".silvermoon",
    "ideas",
    FIRST_ID,
    "status.yaml",
  );
  const configPath = join(repository.root, ".silvermoon", "config.yaml");
  const before = await readFile(statusPath, "utf8");
  const configBefore = await readFile(configPath, "utf8");

  const selected = await whatsNext({
    idea: "localized",
    language: "ZH-cn",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(selected.intention.args, {
    idea: "localized",
    language: "zh-CN",
  });
  assert.equal(selected.observation.outputLanguage, "zh-CN");
  assert.equal(
    selected.observation.configuration.preferredLanguage,
    "fr-FR",
  );
  assert.match(responseText(selected), /^继续在 /);
  assert.match(responseText(selected), /自然语言内容中使用 fr-FR/);
  assert.match(selected.actions[0].result.commit, /^[0-9a-f]{40}$/);
  assert.equal(await readFile(statusPath, "utf8"), before);
  assert.equal(await readFile(configPath, "utf8"), configBefore);

  await writeFile(join(repository.root, "local.txt"), "preserve me\n");
  const blocked = await whatsNext({
    idea: "localized",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(blocked.observation.outputLanguage, "zh-CN");
  assert.match(responseText(blocked), /^检查全部 staged、unstaged 和 untracked 路径/);
  assert.match(
    responseText(blocked),
    /silvermoon whats-next "localized" --language zh-CN/,
  );
});
