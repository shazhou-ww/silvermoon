import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const youtube = "https://www.youtube.com/watch?v=GJgezoCBIHM";
const bilibili = "https://www.bilibili.com/bangumi/play/ep1231558";
const reading = [
  "./docs/getting-started.md",
  "./docs/core-concepts.md",
  "./docs/operations.md",
  "./docs/reference.md",
  "./docs/maintaining.md",
];
const formalTerminologySources = [
  "docs/core-concepts.md",
  "docs/getting-started.md",
  "docs/operations.md",
  "docs/reference.md",
  "docs/maintaining.md",
  "docs/repository-tasks.md",
  "schema/v1/idea-status.schema.json",
  "skills/silvermoon/SKILL.md",
  "skills/silvermoon/references/adoption.md",
  "src/create-idea.js",
  "src/idea-layout.js",
  "src/whatsnext.js",
];

test("keeps both READMEs reader-first and structurally aligned", async () => {
  const [english, chinese] = await Promise.all([
    readFile(resolve(repositoryRoot, "README.md"), "utf8"),
    readFile(resolve(repositoryRoot, "README.zh-CN.md"), "utf8"),
  ]);

  assert.ok(english.indexOf("## Quick Start") < english.indexOf("## Why Silvermoon"));
  assert.ok(chinese.indexOf("## 快速开始") < chinese.indexOf("## 为什么需要 Silvermoon"));
  assert.match(
    english,
    /> Fellow cultivator, you wouldn't want your lifebound project to be without an\s+>\s*artifact spirit, would you\?/,
  );
  assert.match(
    chinese,
    /> 道友也不想自己的本命项目没有器灵吧？/,
  );

  for (const source of [english, chinese]) {
    assert.match(
      source,
      /cdn\.jsdelivr\.net\/gh\/shazhou-ww\/silvermoon@main\/assets\/silvermoon\.svg/,
    );
    assert.match(
      source,
      /cdn\.jsdelivr\.net\/gh\/shazhou-ww\/silvermoon@main\/assets\/silvermoon-mascot\.png" width="160"/,
    );
    assert.doesNotMatch(source, /raw\.githubusercontent\.com\/shazhou-ww\/silvermoon/);
    assert.match(source, /<table>[\s\S]*silvermoon-mascot\.png[\s\S]*<\/table>/);
    assert.doesNotMatch(
      source.match(/<table>[\s\S]*?<\/table>/)?.[0] ?? "",
      /youtube\.com|bilibili\.com/,
    );
    assert.ok(source.includes(youtube));
    assert.ok(source.includes(bilibili));
    for (const target of reading) assert.ok(source.includes(target), target);
  }
});

test("keeps the approved biography bounded and accurate", async () => {
  const [english, chinese] = await Promise.all([
    readFile(resolve(repositoryRoot, "README.md"), "utf8"),
    readFile(resolve(repositoryRoot, "README.zh-CN.md"), "utf8"),
  ]);
  const normalizedEnglish = english.replaceAll(/\s+/g, " ");
  const normalizedChinese = chinese.replaceAll(/\s+/g, "");

  for (const phrase of [
    "the Silvermoon Wolf Clan in the Spirit Realm",
    "one of the split souls of Ling Long",
    "wolf-headed jade scepter",
    "Bamboo Cloudswarm Swords",
  ]) {
    assert.ok(normalizedEnglish.includes(phrase), phrase);
  }
  for (const phrase of ["灵界的银月狼族", "玲珑公主", "狼首玉如意", "青竹蜂云剑"]) {
    assert.ok(normalizedChinese.includes(phrase), phrase);
  }
  assert.match(
    english,
    /- YouTube: \[Episode 150: Overseas Turmoil 26\]\([^)]+"A Record of a Mortal's Journey to Immortality — Episode 150: Overseas Turmoil 26"\)/,
  );
  assert.match(
    english,
    /- Bilibili: \[Episode 150: Overseas Turmoil 26\]/,
  );
  assert.match(chinese, /- YouTube：\[第 150 话：外海风云 26\]/);
  assert.match(chinese, /- 哔哩哔哩：\[第 150 话：外海风云 26\]/);
  assert.doesNotMatch(chinese, /share_source=/);
});

test("limits cultivation aliases to the project READMEs", async () => {
  const [english, chinese, ...formalSources] = await Promise.all([
    readFile(resolve(repositoryRoot, "README.md"), "utf8"),
    readFile(resolve(repositoryRoot, "README.zh-CN.md"), "utf8"),
    ...formalTerminologySources.map((path) =>
      readFile(resolve(repositoryRoot, path), "utf8")
    ),
  ]);

  for (const source of [english, chinese]) {
    assert.match(source, /道心/);
    assert.match(source, /内景/);
    assert.match(source, /现世/);
  }
  for (const source of formalSources) {
    assert.doesNotMatch(source, /道心|内景|现世/);
  }

  const formal = formalSources.join("\n");
  assert.match(formal, /Ideal World \(理想世界\)/);
  assert.match(formal, /Inner World \(主体世界\)/);
  assert.match(formal, /Outer World \(现实世界\)/);
  assert.match(formal, /ideal contract/);
  assert.match(formal, /inner implementation contract/);
  assert.match(formal, /real-world deployment contract/);
});

test("resolves repository-local links in reader documentation", async () => {
  const paths = [
    "README.md",
    "README.zh-CN.md",
    "docs/getting-started.md",
    "docs/core-concepts.md",
    "docs/operations.md",
    "docs/reference.md",
    "docs/maintaining.md",
  ];

  for (const path of paths) {
    const absolute = resolve(repositoryRoot, path);
    const source = await readFile(absolute, "utf8");
    for (const match of source.matchAll(/(?:src="|\[[^\]]+\]\()(\.?\.?\/[^)"#]+)(?:#[^)"\s]+)?/g)) {
      const target = resolve(dirname(absolute), match[1]);
      await assert.doesNotReject(() => readFile(target), `${path}: ${match[1]}`);
    }
  }
});

test("documents fixed additive phase guidance and snapshot validation", async () => {
  const [readme, chineseReadme, core, gettingStarted, operations, reference] =
    await Promise.all([
      readFile(resolve(repositoryRoot, "README.md"), "utf8"),
      readFile(resolve(repositoryRoot, "README.zh-CN.md"), "utf8"),
      readFile(resolve(repositoryRoot, "docs", "core-concepts.md"), "utf8"),
      readFile(resolve(repositoryRoot, "docs", "getting-started.md"), "utf8"),
      readFile(resolve(repositoryRoot, "docs", "operations.md"), "utf8"),
      readFile(resolve(repositoryRoot, "docs", "reference.md"), "utf8"),
    ]);

  for (const source of [
    readme,
    chineseReadme,
    core,
    gettingStarted,
    reference,
  ]) {
    assert.match(source, /\.silvermoon\/guidance\//);
    assert.match(source, /preparing\.md/);
    assert.match(source, /additive|追加/);
    assert.match(source, /fourth\s+contract|第四份\s*contract/);
  }
  assert.match(operations, /\.silvermoon\/guidance\/<phase>\.md/);
  assert.match(operations, /additive/);
  assert.match(operations, /fourth contract/);
  assert.match(operations, /response\.guidance/);
  assert.match(operations, /observation\.guidance/);
  assert.match(operations, /Materialize\s+applicable requirements/);
  assert.match(reference, /contentRevision/);
  assert.match(reference, /32 KiB/);
  assert.match(reference, /SHA-1 or SHA-256/);
  assert.match(reference, /HEAD, worktree, index, commit, or remote/);
  assert.match(reference, /no schema or configuration key/);
  assert.match(gettingStarted, /before any\s+scaffold path is written/);
});

test("documents the four projections and unified event trace", async () => {
  const paths = [
    "README.md",
    "README.zh-CN.md",
    "docs/core-concepts.md",
    "docs/getting-started.md",
    "docs/operations.md",
    "docs/reference.md",
    "docs/repository-tasks.md",
    "skills/silvermoon/SKILL.md",
    "skills/silvermoon/references/adoption.md",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
  );
  const combined = sources.join("\n");

  for (const field of ["intention", "observation", "actions", "response"]) {
    assert.match(combined, new RegExp(`\\\`${field}\\\``));
  }
  assert.match(combined, /response\.nextSteps/);
  assert.match(combined, /response\.guidance/);
  assert.match(combined, /domain-message stream/);
  assert.match(combined, /channel: "domain"/);
  assert.match(combined, /channel: "telemetry"/);
  assert.match(combined, /schema version 2/);
  assert.doesNotMatch(
    combined,
    /intention\s*\/\s*observation\s*\/\s*outcomes\s*\/\s*instructions/,
  );
});

test("documents the dedicated local idea inventory query", async () => {
  const paths = [
    "README.md",
    "README.zh-CN.md",
    "docs/getting-started.md",
    "docs/operations.md",
    "docs/reference.md",
    "docs/repository-tasks.md",
    "skills/silvermoon/SKILL.md",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
  );
  for (const source of sources) assert.match(source, /list-ideas/);
  const detailed = sources.slice(2, 5).join("\n");
  for (const option of [
    "--state",
    "--all",
    "--query",
    "--created-since",
    "--created-before",
    "--sort",
    "--limit",
  ]) {
    assert.match(detailed, new RegExp(option));
  }
  assert.match(detailed, /worktree snapshot/);
  assert.match(detailed, /never fetches|never\s+fetches/);
  assert.match(detailed, /ideas-listed/);
  assert.match(detailed, /idea-list/);
});
