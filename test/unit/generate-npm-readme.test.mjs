import assert from "node:assert/strict";
import { test } from "node:test";

import { generateNpmReadme } from "../../bin/generate-npm-readme.mjs";

const commit = "a".repeat(40);

test("pins Silvermoon jsDelivr main refs to the release commit", () => {
  const source =
    '![logo](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@main/assets/silvermoon.svg)';
  const output = generateNpmReadme({ source, commit });
  assert.equal(
    output,
    `![logo](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon.svg)`,
  );
});

test("migrates the legacy raw main endpoint to commit-pinned jsDelivr", () => {
  const source =
    '![logo](https://raw.githubusercontent.com/shazhou-ww/silvermoon/main/assets/silvermoon.svg)';
  assert.equal(
    generateNpmReadme({ source, commit }),
    `![logo](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon.svg)`,
  );
});

test("rewrites safe relative Markdown images and HTML sources to jsDelivr", () => {
  const source = [
    "![Logo](./assets/silvermoon.svg)",
    '<img src="./assets/silvermoon-mascot.png" width="160">',
  ].join("\n");
  assert.equal(
    generateNpmReadme({ source, commit }),
    [
      `![Logo](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon.svg)`,
      `<img src="https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@${commit}/assets/silvermoon-mascot.png" width="160">`,
    ].join("\n"),
  );
});

test("rewrites Markdown relative links to immutable blob URLs", () => {
  const source = "[Getting Started](./docs/getting-started.md)";
  assert.equal(
    generateNpmReadme({ source, commit }),
    `[Getting Started](https://github.com/shazhou-ww/silvermoon/blob/${commit}/docs/getting-started.md)`,
  );
});

test("rewrites HTML relative hrefs to immutable blob URLs", () => {
  const source = '<a href="./README.zh-CN.md">简体中文</a>';
  assert.equal(
    generateNpmReadme({ source, commit }),
    `<a href="https://github.com/shazhou-ww/silvermoon/blob/${commit}/README.zh-CN.md">简体中文</a>`,
  );
});

test("preserves fragment identifiers on rewritten relative links", () => {
  const source = [
    "[Section](./docs/reference.md#cli)",
    '<a href="./docs/operations.md#publish">Publish</a>',
  ].join("\n");
  const output = generateNpmReadme({ source, commit });
  assert.equal(
    output,
    [
      `[Section](https://github.com/shazhou-ww/silvermoon/blob/${commit}/docs/reference.md#cli)`,
      `<a href="https://github.com/shazhou-ww/silvermoon/blob/${commit}/docs/operations.md#publish">Publish</a>`,
    ].join("\n"),
  );
});

test("is deterministic for the same source and commit", () => {
  const source = [
    "https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@main/assets/silvermoon.svg",
    "[Docs](./docs/getting-started.md)",
    '<a href="./README.zh-CN.md">zh</a>',
  ].join("\n");
  assert.equal(
    generateNpmReadme({ source, commit }),
    generateNpmReadme({ source, commit }),
  );
});

test("preserves external images, links, and HTML references", () => {
  const source = [
    "![badge](https://img.shields.io/npm/v/silvermoon)",
    "[video](https://www.youtube.com/watch?v=GJgezoCBIHM)",
    '<img src="https://example.com/logo.svg">',
    '<a href="//example.com/docs">Docs</a>',
  ].join("\n");
  assert.equal(generateNpmReadme({ source, commit }), source);
});

test("rejects malformed release commits", () => {
  assert.throws(
    () => generateNpmReadme({ source: "# ok", commit: "abc" }),
    /full hexadecimal Git object ID/,
  );
  assert.throws(
    () => generateNpmReadme({ source: "# ok", commit: "g".repeat(40) }),
    /full hexadecimal Git object ID/,
  );
  assert.throws(
    () => generateNpmReadme({ source: "# ok", commit: undefined }),
    /full hexadecimal Git object ID/,
  );
});

test("fails closed on movable hosted repository references", () => {
  for (const source of [
    "https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon/assets/silvermoon.svg",
    "https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@HEAD/assets/silvermoon.svg",
    "https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@feature/assets/silvermoon.svg",
    "https://raw.githubusercontent.com/shazhou-ww/silvermoon/HEAD/assets/silvermoon.svg",
    "https://github.com/shazhou-ww/silvermoon/blob/main/assets/silvermoon.svg",
  ]) {
    assert.throws(
      () => generateNpmReadme({ source, commit }),
      /full Git object ID/,
    );
  }
  assert.throws(
    () =>
      generateNpmReadme({
        source: `https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@${"b".repeat(40)}/assets/silvermoon.svg`,
        commit,
      }),
    /must use release commit/,
  );
});

test("fails closed on unsafe or unknown relative repository references", () => {
  const cases = [
    ["[Docs](docs/getting-started.md)", /Unrecognized relative repository Markdown link/],
    ["[Up](../package.json)", /Unrecognized relative repository Markdown link/],
    ["[Traversal](./docs/../package.json)", /must not traverse/],
    ['<a href="./docs//reference.md">Docs</a>', /must not traverse/],
    ['<a href="/docs/reference.md">Docs</a>', /Unrecognized relative repository HTML href/],
    ["![Logo](./docs/logo.svg)", /Unrecognized relative repository Markdown image/],
    ["![Logo](./assets/logo.txt)", /Unrecognized relative repository Markdown image/],
    ["![Logo](./assets/../package.json)", /must not traverse/],
    ['<img src="./scripts/logo.svg">', /Unrecognized relative repository HTML resource/],
    ['<img src="./assets/%2e%2e/package.json">', /canonical path/],
    ['<img src="./assets/silvermoon.svg#icon">', /canonical path/],
    ['<img src=" ./assets/silvermoon.svg">', /canonical path/],
    ['<img src = "./assets/silvermoon.svg">', /Unrecognized relative repository HTML reference/],
    ["<img src=./assets/silvermoon.svg>", /Unrecognized relative repository HTML reference/],
    ["![Logo][logo]\n[logo]: ./assets/silvermoon.svg", /Unrecognized relative repository Markdown reference/],
  ];
  for (const [source, error] of cases) {
    assert.throws(() => generateNpmReadme({ source, commit }), error, source);
  }
});

test("does not mutate the provided source string", () => {
  const source =
    "See [Getting Started](./docs/getting-started.md) and https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@main/assets/silvermoon.svg";
  const snapshot = source.slice();
  generateNpmReadme({ source, commit });
  assert.equal(source, snapshot);
});

test("fails closed on empty source instead of emitting an empty README", () => {
  for (const source of ["", "   \n\t \n"]) {
    assert.throws(
      () => generateNpmReadme({ source, commit }),
      /README source is empty/,
    );
  }
});
