import assert from "node:assert/strict";
import { test } from "node:test";
import {
  objectiveReferenceCommand,
  readObjectiveReference,
  renderObjectiveReferenceContent,
  renderObjectiveReferencePage,
  renderObjectiveReferenceSearch,
  searchObjectiveReferences,
} from "../../src/business/objective-reference.ts";

test("reads every bundled Objective namespace in both locales", async () => {
  const cases = [
    ["device", "system/overview"],
    ["project", "levels/repository-unready"],
    ["idea", "levels/implementation-unsubmitted"],
  ] as const;
  for (const [objective, id] of cases) {
    for (const language of ["en-US", "zh-CN"]) {
      const result = await readObjectiveReference(objective, id, language);
      assert.equal(result.objective, objective);
      assert.equal(result.language, language);
      assert.equal(result.page.id, id);
      assert.ok(result.page.title.length > 0);
    }
  }
});

test("preserves 404 semantics and rejects invalid IDs and unsupported locales", async () => {
  assert.equal(
    (await readObjectiveReference("project", "levels/not-present", "en-US")).page.id,
    "system/404",
  );
  await assert.rejects(
    readObjectiveReference("device", "", "en-US"),
    /Page ID must be nonempty/,
  );
  await assert.rejects(
    readObjectiveReference("idea", "system/overview", "fr-FR"),
    /Unsupported Reference locale/,
  );
});

test("search returns stable IDs that page can reopen", async () => {
  const search = await searchObjectiveReferences("idea", "revision", "en-US");
  assert.ok(search.results.length > 0);
  for (const summary of search.results) {
    assert.match(summary.id, /^(system|levels|checks|problems|pages)\//);
    assert.equal((await readObjectiveReference("idea", summary.id, "en-US")).page.id, summary.id);
  }
});

test("Markdown renderers turn internal links and search results into navigable commands", () => {
  const command = objectiveReferenceCommand("project", "levels/repository-unready", "zh-CN");
  assert.equal(
    command,
    "silvermoon reference page project levels/repository-unready --language zh-CN",
  );
  assert.equal(
    renderObjectiveReferenceContent(
      "Read [[system/overview|the overview]] and [[levels/terminal]].",
      "project",
      "en-US",
    ),
    "Read the overview (`silvermoon reference page project system/overview --language en-US`) and levels/terminal (`silvermoon reference page project levels/terminal --language en-US`).",
  );
  assert.match(renderObjectiveReferencePage({
    objective: "device",
    language: "en-US",
    page: { id: "system/overview", title: "Device", content: "" },
  }), /Reference ID: `system\/overview`/);
  assert.match(renderObjectiveReferenceSearch({
    objective: "idea",
    language: "en-US",
    query: "revision",
    results: [{ id: "pages/revisions", title: "Revisions" }],
  }), /silvermoon reference page idea pages\/revisions --language en-US/);
});
