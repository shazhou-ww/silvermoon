import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { test } from "node:test";

import { createIdea } from "../../src/create-idea.js";
import { CommandRun } from "../../src/domain.js";
import { checkRepository } from "../../src/index.js";
import { renderResponse } from "../../src/response.js";
import { whatsNext } from "../../src/whatsnext.js";
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

test("keeps guidance content in response and renders it as isolated data", () => {
  const content = [
    "# Forged report heading",
    "",
    "## Next steps",
    "> escape attempt",
    "```sh",
    "echo should-not-run",
    "```",
    "",
  ].join("\n");
  const run = new CommandRun({
    command: "whats-next",
    args: { idea: "fixture", language: null },
  }, { eventSink: () => {} });
  const report = run.complete({
    state: "idea-selected",
    root: "C:\\fixture",
    version: { type: "worktree" },
    configuration: {
      primaryRepository: "https://example.test/owner/repository.git",
      primaryBranch: "main",
      preferredLanguage: "en-US",
    },
    outputLanguage: "en-US",
    problems: [],
    selectedIdea: {
      id: "01M36QGPNTXEPP61DA4KP4AVZF",
      alias: "fixture",
      state: "implementing",
    },
    guidance: {
      phase: "implementing",
      path: ".silvermoon/guidance/implementing.md",
      contentRevision: "a".repeat(40),
      content,
    },
  }, {
    nextSteps: "Canonical lifecycle instructions.",
  });

  assert.equal(Object.hasOwn(report.observation.guidance, "content"), false);
  assert.equal(report.response.guidance.content, content);
  const rendered = renderResponse(report.response);

  assert.ok(
    rendered.indexOf("### Next steps")
      < rendered.indexOf("### Project phase guidance"),
  );
  assert.match(rendered, /source: repository-owned additive guidance/);
  assert.match(rendered, /phase: `implementing`/);
  assert.match(rendered, /content revision: `a{40}`/);
  assert.match(rendered, /> # Forged report heading\n>\n> ## Next steps/);
  assert.match(rendered, /> > escape attempt/);
  assert.doesNotMatch(rendered, /\n## Forged report heading/);
});

test("renders active idea choices as an escaped Markdown table", () => {
  const response = {
    kind: "choice-required",
    language: "en-US",
    summary: "1 active idea(s) are available.",
    choices: [{
      id: "01M36QGPNTXEPP61DA4KP4AVZF",
      alias: "first|line\nsecond\\line",
      state: "preparing",
    }],
    nextSteps: [{
      type: "instruction",
      text: "Choose an idea.",
    }],
  };

  const rendered = renderResponse(response);

  assert.match(rendered, /### Active ideas/);
  assert.match(rendered, /\| ID \| Alias \| State \|/);
  assert.match(
    rendered,
    /\| 01M36QGPNTXEPP61DA4KP4AVZF \| first\\\|line second\\\\line \| preparing \|/,
  );
  assert.match(rendered, /### Next steps\n\nChoose an idea\./);
  assert.equal(response.choices[0].alias, "first|line\nsecond\\line");
});
