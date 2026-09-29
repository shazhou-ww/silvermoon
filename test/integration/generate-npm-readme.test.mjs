import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { generateNpmReadme } from "../../scripts/generate-npm-readme.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const readmePath = resolve(repositoryRoot, "README.md");
const generatorPath = resolve(repositoryRoot, "scripts/generate-npm-readme.mjs");
const commit = "b".repeat(40);

test("rewrites the real repository README onto an immutable commit without touching the source file", async () => {
  const before = await readFile(readmePath, "utf8");
  const output = generateNpmReadme({ source: before, commit });

  assert.doesNotMatch(
    output,
    /cdn\.jsdelivr\.net\/gh\/shazhou-ww\/silvermoon@(?:main|HEAD)\//,
  );
  assert.doesNotMatch(
    output,
    /raw\.githubusercontent\.com\/shazhou-ww\/silvermoon\//,
  );
  assert.doesNotMatch(output, /\]\(\.\.?\/[^)]+\)/);
  assert.doesNotMatch(output, /\b(?:href|src)="\.\.?\/[^"]+"/i);
  assert.match(
    output,
    new RegExp(
      `cdn\\.jsdelivr\\.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon\\.svg`,
    ),
  );
  assert.match(
    output,
    new RegExp(
      `cdn\\.jsdelivr\\.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon-avatar\\.svg`,
    ),
  );
  assert.match(
    output,
    new RegExp(
      `https://github\\.com/shazhou-ww/silvermoon/blob/${commit}/README\\.zh-CN\\.md`,
    ),
  );
  assert.match(
    output,
    new RegExp(
      `https://github\\.com/shazhou-ww/silvermoon/blob/${commit}/docs/getting-started\\.md`,
    ),
  );

  const after = await readFile(readmePath, "utf8");
  assert.equal(after, before);

  const cli = spawnSync(process.execPath, [generatorPath, "--commit", commit], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout, output);
  assert.equal(await readFile(readmePath, "utf8"), before);
});

test("--out writes the generated README atomically without truncating the source", async () => {
  const before = await readFile(readmePath, "utf8");
  const outputDirectory = await mkdtemp(join(tmpdir(), "silvermoon-readme-"));
  const outPath = join(outputDirectory, "README.md");
  const cli = spawnSync(
    process.execPath,
    [generatorPath, "--commit", commit, "--out", outPath],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true },
  );
  try {
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout, "");
    assert.equal(await readFile(outPath, "utf8"), generateNpmReadme({ source: before, commit }));
    // The source README must survive an --out run byte-identical.
    assert.equal(await readFile(readmePath, "utf8"), before);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
