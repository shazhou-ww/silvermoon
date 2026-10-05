import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { test } from "node:test";

import { createIdea } from "../../src/business/create-idea.js";
import { checkRepository } from "../../src/index.js";
import { whatsNext } from "../../src/business/whats-next.js";
import { createRepository } from "../helpers/repository.js";

test("all public commands return exactly four projections", async () => {
  const repository = await createRepository({ prefix: "silvermoon-output-contract-" });
  try {
    const options = { root: repository.root, userHome: repository.base };
    const navigation = await whatsNext(options);
    const check = await checkRepository(options);
    const creation = await createIdea(options);

    for (const report of [navigation, check, creation]) {
      assert.deepEqual(Object.keys(report), [
        "intention",
        "observation",
        "actions",
        "response",
      ]);
      assert.equal(Object.hasOwn(report, "outcomes"), false);
      assert.equal(Object.hasOwn(report, "instructions"), false);
      assert.equal(typeof report.observation.outputLanguage, "string");
      assert.ok(Array.isArray(report.actions));
      assert.equal(typeof report.response.kind, "string");
      assert.equal(typeof report.response.summary, "string");
    }

    assert.equal(navigation.observation.state, "navigation-ready");
    assert.equal(navigation.observation.version.type, "worktree");
    assert.equal(navigation.response.kind, "choice-required");
    assert.deepEqual(navigation.intention.args, {
      idea: null,
      language: null,
    });
    assert.deepEqual(
      navigation.actions.map(({ type, status }) => [type, status]),
      [["fetch-primary", "success"]],
    );

    assert.equal(check.observation.state, "project-ready");
    assert.equal(check.observation.version.type, "commit");
    assert.equal(check.response.kind, "validation-result");
    assert.equal(check.response.validation.valid, true);
    assert.deepEqual(check.actions, []);

    assert.equal(creation.observation.state, "idea-created");
    assert.equal(creation.observation.version.type, "worktree");
    assert.equal(creation.response.kind, "idea-created");
    assert.equal(creation.observation.createdIdea.state, "preparing");
    assert.equal(
      creation.response.createdIdea.id,
      creation.observation.createdIdea.id,
    );
    assert.deepEqual(
      creation.actions.map(({ type, status }) => [type, status]),
      [["create-idea-scaffold", "success"]],
    );

    const unavailable = await checkRepository({
      ...options,
      commit: "missing-revision",
    });
    assert.deepEqual(Object.keys(unavailable), [
      "intention",
      "observation",
      "actions",
      "response",
    ]);
    assert.equal(unavailable.observation.state, "check-unavailable");
    assert.equal(unavailable.response.kind, "validation-result");
    assert.equal(unavailable.response.validation.valid, false);
    assert.equal(unavailable.observation.problems[0].type, "commit-unavailable");
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});
