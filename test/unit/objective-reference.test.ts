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

test("exposes uniform metadata and preserves static guidance in Reference bodies", async () => {
  const english = await readObjectiveReference(
    "project",
    "problems/repository-worktree",
    "en-US",
  );
  assert.match(
    english.page.description ?? "",
    /worktree/i,
  );
  assert.match(
    english.page.content,
    /Preserve unknown work[\s\S]+clean worktree/,
  );
  assert.match(english.page.content, /## Problem guidance/);
  assert.deepEqual(english.page.references, []);
  assert.equal("instruction" in english.page, false);
  assert.equal("outcome" in english.page, false);

  const chinese = await readObjectiveReference(
    "project",
    "problems/repository-worktree",
    "zh-CN",
  );
  assert.match(
    chinese.page.description ?? "",
    /worktree/i,
  );
  assert.match(
    chinese.page.content,
    /保留未知工作[\s\S]+worktree clean/,
  );
  assert.match(chinese.page.content, /## 问题说明/);

  const configuration = await readObjectiveReference(
    "device",
    "problems/device-configuration-format",
    "en-US",
  );
  assert.match(
    configuration.page.content,
    /silvermoon reference page:user-configuration --language en-US/,
  );
  assert.doesNotMatch(
    configuration.page.content,
    /silvermoon reference page device pages\//,
  );

  const projectMetadata = await resolveObjectiveReference(
    "page:project-metadata",
    "zh-CN",
  );
  assert.ok("page" in projectMetadata);
  assert.equal(projectMetadata.owner, "project");
  assert.equal(projectMetadata.referenceId, "pages/project-metadata");
  assert.match(projectMetadata.page.content, /\.silvermoon\/config\.yaml/);
  assert.match(projectMetadata.page.content, /silvermoon create-idea/);
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
    page: { id: "system/overview", title: "设备目标", description: "设备整备。", references: [], content: "" },
  } as const;
  const expectedPage = [
    "# 设备目标",
    "",
    "设备整备。",
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

test("page Markdown exposes declared related references without expanding their content", () => {
  const rendered = renderObjectiveReferencePage({
    objective: "project",
    language: "en-US",
    page: {
      id: "pages/related",
      title: "Related",
      description: "Summary",
      references: ["system/overview", "levels/terminal"],
      content: "Page content.",
    },
  });
  assert.match(rendered, /## Related references/);
  assert.match(rendered, /silvermoon reference system:overview --language en-US/);
  assert.match(rendered, /silvermoon reference level:terminal --language en-US/);
  assert.match(rendered, /Page content\./);
});
