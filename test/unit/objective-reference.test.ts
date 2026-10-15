import assert from "node:assert/strict";
import { test } from "node:test";
import {
  objectiveReferenceCommand,
  objectiveReferenceLookup,
  parseObjectiveReferenceLookup,
  readObjectiveReference,
  renderObjectiveReferenceContent,
  renderObjectiveReferenceLookup,
  renderObjectiveReferencePage,
  renderObjectiveReferenceSearch,
  resolveObjectiveReference,
  searchObjectiveReferences,
} from "../../src/business/objective-reference.ts";
import { SILVERMOON_CHECK_PROBLEMS } from "../../src/business/objective-guides.ts";

test("legacy readers still address every bundled Objective in both locales", async () => {
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
    }
  }
});

test("parses namespace lookups and rejects unsafe or malformed input", () => {
  assert.deepEqual(parseObjectiveReferenceLookup("problem:repository-worktree"), {
    namespace: "problem",
    query: "repository-worktree",
  });
  assert.deepEqual(parseObjectiveReferenceLookup("repository state"), {
    namespace: null,
    query: "repository state",
  });
  for (
    const lookup of [
      "",
      ":repository",
      "project:repository",
      "constructor:repository",
      "toString:repository",
      "problem:",
      "a:b:c",
      "..",
      "a\\b",
    ]
  ) {
    assert.throws(() => parseObjectiveReferenceLookup(lookup));
  }
});

test("explicit namespace recursively resolves the actual owner", async () => {
  const result = await resolveObjectiveReference(
    "check:repository-upstream-matches",
    "zh-CN",
  );
  assert.ok("page" in result);
  assert.equal(result.owner, "project");
  assert.equal(result.referenceId, "checks/repository-upstream-matches");
  assert.equal(result.namespace, "check");
  assert.equal(result.language, "zh-CN");
  assert.equal(result.page.id, "checks/repository-upstream-matches");
});

test("every declared Problem has one unambiguous explicit lookup", async () => {
  const problemIds = Object.values(SILVERMOON_CHECK_PROBLEMS).flat();
  assert.equal(new Set(problemIds).size, problemIds.length);
  for (const problemId of problemIds) {
    const result = await resolveObjectiveReference(`problem:${problemId}`);
    assert.ok("page" in result, problemId);
    assert.equal(result.referenceId, `problems/${problemId}`);
  }
});

test("explicit namespace reports ambiguity instead of selecting by traversal order", async () => {
  const result = await resolveObjectiveReference("system:overview");
  assert.ok("ambiguous" in result);
  assert.deepEqual(result.candidates.map(({ owner }) => owner), [
    "idea",
    "project",
    "device",
  ]);
  assert.match(renderObjectiveReferenceLookup(result), /Ambiguous Reference/);
});

test("search auto-opens one result, lists many, and succeeds with none", async () => {
  const one = await resolveObjectiveReference("repository-upstream-matches");
  assert.ok("page" in one);
  assert.equal(one.operation, "search");
  assert.equal(one.owner, "project");
  assert.equal(one.referenceId, "checks/repository-upstream-matches");

  const many = await resolveObjectiveReference("revision", "en-US");
  assert.ok("results" in many);
  assert.ok(many.results.length > 1);
  assert.ok(many.results.every(({ namespace, owner, referenceId, command }) =>
    namespace.length > 0
    && owner.length > 0
    && referenceId.length > 0
    && command.startsWith("silvermoon reference ")
  ));
  assert.match(renderObjectiveReferenceLookup(many), /owner: `idea`/);

  const none = await resolveObjectiveReference("__no_reference_match__");
  assert.ok("results" in none);
  assert.deepEqual(none.results, []);
});

test("new commands and internal links use explicit namespace without owner", () => {
  assert.equal(
    objectiveReferenceLookup("levels/repository-unready"),
    "level:repository-unready",
  );
  assert.equal(
    objectiveReferenceCommand("project", "levels/repository-unready", "zh-CN"),
    "silvermoon reference level:repository-unready --language zh-CN",
  );
  assert.equal(
    renderObjectiveReferenceContent(
      "Read [[system/overview|the overview]] and [[levels/terminal]].",
      "project",
      "en-US",
    ),
    "Read the overview (`silvermoon reference system:overview --language en-US`) and levels/terminal (`silvermoon reference level:terminal --language en-US`).",
  );
});

test("legacy page and search business APIs retain their behavior", async () => {
  assert.equal(
    (await readObjectiveReference("project", "levels/not-present", "en-US")).page.id,
    "system/404",
  );
  const search = await searchObjectiveReferences("idea", "revision", "en-US");
  assert.ok(search.results.length > 0);
  for (const summary of search.results) {
    assert.equal((await readObjectiveReference("idea", summary.id, "en-US")).page.id, summary.id);
  }
});

test("page and search Markdown are readable for both audiences", () => {
  const page = {
    objective: "device",
    language: "zh-CN",
    page: { id: "system/overview", title: "设备目标", content: "" },
  } as const;
  const expectedPage = [
    "# 设备目标",
    "",
    "所属 Objective: `device`",
    "引用 ID: `system/overview`",
    "打开: `silvermoon reference system:overview --language zh-CN`",
  ].join("\n");
  assert.equal(renderObjectiveReferencePage(page, "human"), expectedPage);
  assert.equal(renderObjectiveReferencePage(page, "agent"), expectedPage);

  const search = {
    objective: "idea",
    language: "zh-CN",
    query: "修订",
    results: [{ id: "pages/revisions", title: "修订" }],
  } as const;
  assert.equal(renderObjectiveReferenceSearch(search, "human"), [
    "# Objective 引用搜索：修订",
    "",
    "- 修订 (`silvermoon reference page:revisions --language zh-CN`)",
  ].join("\n"));
  assert.equal(renderObjectiveReferenceSearch(search, "agent"), renderObjectiveReferenceSearch(search, "human"));
});
