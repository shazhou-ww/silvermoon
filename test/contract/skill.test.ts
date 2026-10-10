import assert from "node:assert/strict";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
async function findSkillFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: string[] = [];
  for (const entry of entries) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) matches.push(...(await findSkillFiles(path)));
    if (entry.isFile() && entry.name === "SKILL.md") matches.push(path);
  }
  return matches;
}

async function findMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: string[] = [];
  for (const entry of entries) {
    if ([".git", "ideas", "node_modules"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
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
    const frontmatterSource = frontmatter[1];
    if (frontmatterSource === undefined) assert.fail(`Skill frontmatter is empty: ${path}`);
    const document = parseDocument(frontmatterSource);
    if (document.get("name") === "silvermoon") {
      silvermoonSkills.push({ document, path, source });
    }
  }
  assert.equal(silvermoonSkills.length, 1);

  const skill = silvermoonSkills[0];
  if (skill === undefined) assert.fail("silvermoon skill is missing");
  const { document, path, source } = skill;
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
  const prose = source.replace(/```[\s\S]*?```/g, "");
  assert.deepEqual(
    [...prose.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading),
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
    "device or host concerns",
    "Never add Silvermoon to a target repository's dependency",
    "~/.agents/skills/silvermoon",
    "~/.copilot/skills/silvermoon",
    "register it globally by link rather than copy",
    "not exempt from the device boundary",
    "link the current checkout as the device-level global runtime",
    "a repository-local skill copy",
    "do not read `package.json`, `node_modules`, or repository",
    "turn the scaffold into the preparation candidate",
    "human gate accepts only the exact reported",
    "Preparation is the one exception to strict phase-local authoring",
    "When creating a new idea, proactively assign a concise, unique alias",
    "Use an alias supplied by the user, or derive one from the idea's",
    "Do not leave the alias absent or ask for a name solely",
    "all ordered `response.nextSteps`",
    "unknown, unrelated, or user-authored work",
    "Never use force-push",
    "For v1 projects there is no decision mutation command",
    "Exceptional history maintenance edits the complete `events.jsonl` file directly",
    "there is no revise or recover command",
    "Ideal World (理想世界)",
    "Inner World (主体世界)",
    "Outer World (现实世界)",
    "contain supporting files, but those artifacts serve the same-world entry",
    "Use progressive elaboration in every world",
    "`Idea.md` is a short direction card",
    "one to three material boundaries and acceptance criteria",
    "no more than three high-level steps and three criteria per contract",
    "Before Idea acceptance, replace every scaffold placeholder",
    "let the Implementation contract absorb Deployment detail",
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
    "all seeded `I-*` and `D-*` entries remain unchecked",
    "do not block Idea acceptance",
    "During implementation, continue while a relevant `I-*` entry is unchecked",
    "during deployment, do the same for `D-*`",
    "It never stages, commits,",
    "make every created or updated lifecycle candidate ready for its current gate",
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
    "Never infer an idea selector, approval, acceptance, abandonment, or reversal",
    "do not poll an unchanged observation",
    "Never request approval or acceptance for content that is not yet synchronized to primary",
    "They are Agent responsibilities, not Silvermoon human decisions",
    "review message is an index to that evidence",
    "host-clickable local link",
    "immutable, commit-pinned remote link",
    "interactive decision tool",
    "standalone, completed ordinary assistant Markdown message",
    "Never invoke an interactive decision tool in the same assistant turn",
    "`response.review`",
    "`response.review.presentation`",
    "`selectedIdea.submissions`",
    "appears only when the exact current phase revision is submitted",
    "Do not maintain or infer a second gate template",
    "`requiresLocalization`",
    "Never derive gate prose from the report's output language",
    "compact order directed by `response.nextSteps`",
    "Do not add lifecycle-policy essays",
    "If the tool is unavailable",
    "after one concise wait statement; do not retry it or repeat the gate rationale",
    "12-character revision and commit references",
    "Do not list placeholders",
    "always `Implementation.md` and `ledger.md`",
    "always `Deployment.md` and `ledger.md`",
    "Do not put local file links",
    "absolute drive path with forward slashes",
    "`file://` URI",
    "commit-pinned remote link",
    "Confirm the commit is reachable from refreshed primary",
  ]) {
    assert.ok(
      source.replace(/\s+/g, " ").includes(required),
      `silvermoon skill is missing: ${required}`,
    );
  }
  assert.doesNotMatch(
    source,
    /silvermoon task |silvermoon status|silvermoon whatsnext|taskLanguage|criteriaEvidence|verifyCriteriaEvidence|implementationCriterionIds|ledger\.md \(optional\)|revision frontmatter|\*\*Candidate:\*\*|### Review files|### Decision|\[local\] \| \[(?:pinned|remote)\]/,
  );

  for (const match of source.matchAll(/\[[^\]]+\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
    const target = match[1];
    if (target === undefined) assert.fail("skill link target capture is required");
    const referenced = resolve(dirname(path), target);
    await assert.doesNotReject(() => readFile(referenced));
  }
});

test("keeps the canonical skill out of repository discovery paths", async () => {
  const canonical = resolve(repositoryRoot, "skills", "silvermoon");
  const registration = resolve(
    repositoryRoot,
    ".agents",
    "skills",
    "silvermoon",
  );
  assert.equal((await lstat(canonical)).isDirectory(), true);
  await assert.rejects(
    lstat(registration),
    (error: NodeJS.ErrnoException) => error.code === "ENOENT",
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