import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { test } from "node:test";

import { createIdea } from "../../src/create-idea.js";
import { checkRepository } from "../../src/index.js";
import { whatsNext } from "../../src/whatsnext.js";
import { createRepository } from "../helpers/repository.js";

test("public commands share intention and observation but only dialogues add outcomes and instructions", async () => {
  const repository = await createRepository({ prefix: "silvermoon-output-contract-" });
  try {
    const options = { root: repository.root, userHome: repository.base };
    const navigation = await whatsNext(options);
    const check = await checkRepository(options);
    const creation = await createIdea(options);

    for (const report of [navigation, creation]) {
      assert.deepEqual(Object.keys(report).sort(), [
        "instructions",
        "intention",
        "observation",
        "outcomes",
      ]);
      assert.equal(report.observation.version.type, "worktree");
      assert.deepEqual(report.observation.problems, []);
      assert.equal(typeof report.instructions, "string");
      assert.ok(Array.isArray(report.outcomes));
    }
    assert.equal(navigation.observation.state, "navigation-ready");
    assert.equal(Object.hasOwn(navigation.observation, "selectedIdea"), false);
    assert.equal(creation.observation.state, "idea-created");
    assert.equal(creation.observation.createdIdea.state, "preparing");
    assert.equal(Object.hasOwn(creation.observation, "ideas"), false);
    assert.deepEqual(Object.keys(check).sort(), ["intention", "observation"]);
    assert.deepEqual(check.intention, {
      command: "check",
      args: { target: { type: "head" } },
    });
    assert.equal(check.observation.state, "project-ready");
    assert.deepEqual(check.observation.problems, []);
    assert.equal(check.observation.ideas.counts.preparing, 1);
    assert.equal(typeof check.observation.configuration.preferredLanguage, "string");

    const unavailable = await checkRepository({
      ...options,
      commit: "missing-revision",
    });
    assert.deepEqual(Object.keys(unavailable).sort(), ["intention", "observation"]);
    assert.equal(unavailable.observation.state, "check-unavailable");
    assert.deepEqual(unavailable.observation.version, { type: "commit", commit: null });
    assert.equal(unavailable.observation.problems[0].type, "commit-unavailable");
    assert.equal(Object.hasOwn(unavailable.observation, "configuration"), false);
    assert.equal(Object.hasOwn(unavailable.observation, "ideas"), false);
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});
