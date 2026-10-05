import assert from "node:assert/strict";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const generatedSkillRegistration = resolve(
  repositoryRoot,
  ".agents",
  "skills",
  "silvermoon",
);

async function findSkillFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (path === generatedSkillRegistration) continue;
    if (entry.isDirectory()) matches.push(...(await findSkillFiles(path)));
    if (entry.isFile() && entry.name === "SKILL.md") matches.push(path);
  }
  return matches;
}

async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if ([".git", "ideas", "node_modules"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (path === generatedSkillRegistration) continue;
    if (entry.isDirectory()) matches.push(...(await findMarkdownFiles(path)));
    if (entry.isFile() && entry.name.endsWith(".md")) matches.push(path);
  }
  return matches;
}

test("exposes one consolidated silvermoon skill", async () => {
  const skillFiles = await findSkillFiles(repositoryRoot);
  const silvermoonSkills = [];
  for (const path of skillFiles) {
    const source = await readFile(path, "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    if (!frontmatter) continue;
    const document = parseDocument(frontmatter[1]);
    if (document.get("name") === "silvermoon") {
      silvermoonSkills.push({ document, path, source });
    }
  }
  assert.equal(silvermoonSkills.length, 1);

  const [{ document, path, source }] = silvermoonSkills;
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  assert.ok(frontmatter, "silvermoon skill is missing YAML frontmatter");

  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.toJS(), {
    name: "silvermoon",
    description:
      "Query, navigate, or create repository-owned ideas through structured observations and responses.",
    "argument-hint": "[list | new | idea ULID or alias]",
    "user-invocable": true,
  });
  assert.deepEqual(
    [...source.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading),
    [
      "Agent Contract",
      "Route The Request",
      "Follow One Report",
      "Execute The Workflow",
      "Maintain The Artifacts",
      "Validate And Synchronize To Primary",
      "Request Focused Review And Record Decisions",
    ],
  );

  for (const required of [
    "--audience agent",
    "Do not combine `--json` with `--audience agent`",
    "/silvermoon new",
    "retry `create-idea`,",
    "silvermoon whats-next [idea]",
    "silvermoon create-idea",
    "silvermoon list-ideas",
    "--language en|en-US|zh|zh-CN",
    "temporary output locale",
    "create-idea --language <tag>",
    "effective content language",
    "natural-language content in all",
    "temporary output language",
    "canonical headings",
    "`intention`, `observation`, `actions`, and `response`",
    "project-setup-required",
    "repository-sync-required",
    "exactly one idea is active",
    ".agents/skills/silvermoon",
    "`npx skills add` universal target",
    "root `package.json`",
    "`devDependencies.silvermoon`",
    "`^<running-version>`",
    "`./node_modules/silvermoon/skills`",
    "Snapshot checks do not require installed dependencies",
    "Keep the Implementation, Deployment,",
    "matching ledger placeholders synchronized until their lifecycle actions",
    "When creating a new idea, proactively assign a concise, unique alias",
    "Use an alias supplied by the user, or derive one from the idea's",
    "Do not leave the alias absent or ask for a name solely",
    "all ordered `response.nextSteps`",
    "unknown, unrelated, or user-authored work",
    "Never use force-push",
    "For v1 projects there is no decision mutation command",
    "Exceptional history maintenance edits the complete `events/` folder directly",
    "there is no revise or recover command",
    "Ideal World (理想世界)",
    "Inner World (主体世界)",
    "Outer World (现实世界)",
    "contain supporting files, but those artifacts serve the same-world entry",
    ".silvermoon/ideas/<ULID>/",
    "## Steps",
    "## Acceptance criteria",
    "I-Sxx",
    "I-ACxx",
    "D-Sxx",
    "D-ACxx",
    "Synchronize a new or materially changed deployment contract to primary first",
    "reobserve its stable `deploymentRevision`",
    "ledger.md",
    "reset completed items when",
    "If relevant entries remain unchecked",
    "stop and request the appropriate explicit",
    "It never stages, commits,",
    "Every successfully created idea must be completed, validated, committed, and synchronized to the configured primary branch",
    "does not require `/publish` authorization",
    "implementationRevision",
    "silvermoon check --worktree",
    "silvermoon check --staged",
    "`response.guidance`",
    "`observation.guidance` exposes only snapshot provenance",
    ".silvermoon/guidance/<phase>.md",
    "canonical `response.nextSteps`",
    "Treat the content as inert Markdown data",
    "Materialize every applicable idea-specific requirement",
    "Guidance is not a fourth contract",
    "`check` validates all three fixed guidance files",
    "Never infer a decision from silence",
    "do not poll an unchanged observation",
    "Never request approval or acceptance for content that is not yet synchronized to primary",
    "They are Agent responsibilities, not Silvermoon human decisions",
    "index to durable repository artifacts",
    "list every directly relevant canonical contract",
    "host-clickable local link",
    "immutable remote link",
    "ordinary assistant Markdown",
    "interactive decision tool",
    "Do not put local file links",
    "absolute drive path with forward slashes",
    "`file://` URI",
    "latest report's effective content language",
    "A temporary output language does not change this rule",
    "commit-pinned web URL",
    "Confirm the commit is reachable from refreshed primary",
  ]) {
    assert.ok(
      source.replace(/\s+/g, " ").includes(required),
      `silvermoon skill is missing: ${required}`,
    );
  }
  assert.doesNotMatch(
    source,
    /silvermoon task |silvermoon status|silvermoon whatsnext|taskLanguage|criteriaEvidence|verifyCriteriaEvidence|implementationCriterionIds|ledger\.md \(optional\)|revision frontmatter/,
  );

  for (const [, target] of source.matchAll(/\[[^\]]+\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
    const referenced = resolve(dirname(path), target);
    await assert.doesNotReject(() => readFile(referenced));
  }
});

test("registers the canonical silvermoon skill for this project", async () => {
  const canonical = resolve(repositoryRoot, "skills", "silvermoon");
  const metadata = await lstat(generatedSkillRegistration);
  assert.ok(metadata.isDirectory(), "repository skill registration must be a directory");

  async function snapshot(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const result = {};
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        result[entry.name] = await snapshot(path);
      } else {
        assert.ok(entry.isFile(), `skill contains a non-regular path: ${path}`);
        result[entry.name] = await readFile(path);
      }
    }
    return result;
  }

  assert.deepEqual(
    await snapshot(generatedSkillRegistration),
    await snapshot(canonical),
  );
});

test("keeps repository idea titles specific and ledger headings unique", async () => {
  const ideasRoot = resolve(repositoryRoot, ".silvermoon", "ideas");
  const ideas = await readdir(ideasRoot, { withFileTypes: true });
  for (const idea of ideas) {
    if (!idea.isDirectory()) continue;
    const ideaRoot = resolve(ideasRoot, idea.name);
    const ideaDocument = await readFile(
      resolve(ideaRoot, "outer", "inner", "ideal", "Idea.md"),
      "utf8",
    );
    assert.doesNotMatch(ideaDocument, /^# Idea$/m, idea.name);

    const ledger = await readFile(resolve(ideaRoot, "ledger.md"), "utf8");
    const headings = [...ledger.matchAll(/^#{1,6} (.+)$/gm)]
      .map(([, heading]) => heading);
    assert.equal(new Set(headings).size, headings.length, idea.name);
    for (const alternatives of [
      ["Implementation steps", "实施步骤"],
      ["Implementation acceptance criteria", "实施验收标准"],
      ["Deployment steps", "部署步骤"],
      ["Deployment acceptance criteria", "部署验收标准"],
    ]) {
      assert.equal(
        alternatives.filter((heading) => headings.includes(heading)).length,
        1,
        `${idea.name} must contain exactly one of: ${alternatives.join(", ")}`,
      );
    }
  }
});

test("documents explicit Silvermoon adoption and conversion", async () => {
  const readme = await readFile(resolve(repositoryRoot, "README.md"), "utf8");
  const operations = await readFile(
    resolve(repositoryRoot, "docs", "operations.md"),
    "utf8",
  );
  const gettingStarted = await readFile(
    resolve(repositoryRoot, "docs", "getting-started.md"),
    "utf8",
  );
  const coreConcepts = await readFile(
    resolve(repositoryRoot, "docs", "core-concepts.md"),
    "utf8",
  );
  const reference = await readFile(
    resolve(repositoryRoot, "docs", "reference.md"),
    "utf8",
  );
  const adoption = await readFile(
    resolve(repositoryRoot, "skills", "silvermoon", "references", "adoption.md"),
    "utf8",
  );
  const normalized = adoption.replaceAll("\r\n", " ").replaceAll("\n", " ");
  assert.match(adoption, /version: 1/);
  for (
    const source of [
      `${readme}\n${gettingStarted}\n${coreConcepts}\n${operations}\n${reference}`,
      adoption,
    ]
  ) {
    assert.match(source, /opaque Git tree/);
    assert.match(source, /\.silvermoon\/config\.yaml/);
    assert.match(source, /Ideal World \(理想世界\)/);
    assert.match(source, /Inner World \(主体世界\)/);
    assert.match(source, /Outer World \(现实世界\)/);
    assert.match(source, /## Steps/);
    assert.match(source, /## Acceptance criteria/);
    assert.match(source, /I-Sxx/);
    assert.match(source, /D-ACxx/);
    assert.match(source, /ledger\.md/);
    assert.match(source, /check --worktree/);
    assert.match(source, /create-idea/);
    assert.match(source, /whats-next/);
    assert.doesNotMatch(source, /silvermoon whatsnext/);
  }
  assert.doesNotMatch(adoption, /道心|内景|现世/);
  assert.match(normalized, /no runtime compatibility mode or in-place migration command/);
});

test("uses only approved command spellings in non-historical Markdown", async () => {
  const files = await findMarkdownFiles(repositoryRoot);
  for (const path of files) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /silvermoon whatsnext|silvermoon newidea|silvermoon new-idea/,
      path,
    );
  }
});