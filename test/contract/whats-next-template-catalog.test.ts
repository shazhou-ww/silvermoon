import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { test } from "node:test";

import {
  WHATS_NEXT_TEMPLATE_IDS,
  whatsNextTemplates,
} from "../../src/foundation/report/templates/whats-next/index.ts";

const CATALOG_ROOT = resolve(
  "src",
  "foundation",
  "report",
  "templates",
  "whats-next",
);
const LOCALES = ["en-US", "zh-CN"] as const;
const HEADER_PATTERN =
  /^\/\*\*\r?\n \* @template (\S+)\r?\n \* @when ([^\r\n]+)\r?\n \* ([^\r\n]+)\r?\n \*\//;

async function catalogFiles(locale: typeof LOCALES[number]) {
  return (await readdir(resolve(CATALOG_ROOT, locale), {
    withFileTypes: true,
  }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts")
      && entry.name !== "index.ts")
    .map((entry) => entry.name)
    .sort();
}

async function templateHeader(locale: typeof LOCALES[number], file: string) {
  const source = await readFile(resolve(CATALOG_ROOT, locale, file), "utf8");
  const match = source.match(HEADER_PATTERN);
  assert.ok(match, `${locale}/${file} must start with the template header`);
  const [, id, when, explanation] = match;
  assert.ok(id);
  assert.ok(when);
  assert.ok(explanation);
  return { explanation, id, when };
}

test("what's next locale catalogs have symmetric files and headers", async () => {
  const englishFiles = await catalogFiles("en-US");
  const chineseFiles = await catalogFiles("zh-CN");
  assert.deepEqual(chineseFiles, englishFiles);

  for (const file of englishFiles) {
    const [english, chinese] = await Promise.all([
      templateHeader("en-US", file),
      templateHeader("zh-CN", file),
    ]);
    const fileId = basename(file, ".ts");
    assert.equal(english.id, fileId);
    assert.equal(chinese.id, fileId);
    assert.equal(chinese.when, english.when);
    assert.doesNotMatch(english.explanation, /[\u3400-\u9fff]/u);
    assert.match(chinese.explanation, /[\u3400-\u9fff]/u);
  }
});

test("what's next registries contain every catalog file exactly once", async () => {
  const files = await catalogFiles("en-US");
  const fileIds = files.map((file) => basename(file, ".ts")).sort();
  const englishIds = Object.keys(whatsNextTemplates("en-US")).sort();
  const chineseIds = Object.keys(whatsNextTemplates("zh-CN")).sort();

  assert.deepEqual(englishIds, fileIds);
  assert.deepEqual(chineseIds, fileIds);
  assert.deepEqual([...WHATS_NEXT_TEMPLATE_IDS].sort(), fileIds);
  assert.equal(new Set(WHATS_NEXT_TEMPLATE_IDS).size, fileIds.length);
});
