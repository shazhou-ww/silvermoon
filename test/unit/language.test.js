import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalizeLanguageTag,
  canonicalizeOutputLanguage,
  DEFAULT_LANGUAGE,
  isCanonicalLanguageTag,
  OUTPUT_LANGUAGES,
  resolveLanguage,
  resolveOutputLanguage,
} from "../../src/project/rules/language.js";

test("canonicalizes valid BCP 47 language tags", () => {
  assert.equal(canonicalizeLanguageTag("zh-cn"), "zh-CN");
  assert.equal(canonicalizeLanguageTag("EN-us"), "en-US");
  assert.equal(isCanonicalLanguageTag("zh-CN"), true);
  assert.equal(isCanonicalLanguageTag("zh-cn"), false);
});

test("rejects invalid or non-string language tags", () => {
  for (const value of ["", " zh-CN", "en_US", 42, null]) {
    assert.throws(() => canonicalizeLanguageTag(value), /language tag|BCP 47/);
    assert.equal(isCanonicalLanguageTag(value), false);
  }
});

test("normalizes the short and full built-in output language names", () => {
  assert.deepEqual(OUTPUT_LANGUAGES, ["en-US", "zh-CN"]);
  assert.equal(Object.isFrozen(OUTPUT_LANGUAGES), true);
  assert.equal(canonicalizeOutputLanguage("EN-us"), "en-US");
  assert.equal(canonicalizeOutputLanguage("zh-cn"), "zh-CN");
  assert.equal(canonicalizeOutputLanguage("en"), "en-US");
  assert.equal(canonicalizeOutputLanguage("EN"), "en-US");
  assert.equal(canonicalizeOutputLanguage("zh"), "zh-CN");
  assert.equal(canonicalizeOutputLanguage("ZH"), "zh-CN");

  for (const value of ["", "en_US", "fr-FR"]) {
    assert.throws(
      () => canonicalizeOutputLanguage(value),
      (error) => error.exitCode === 2,
    );
  }
});

test("resolves language from the most specific configured layer", () => {
  assert.deepEqual(
    resolveLanguage({ idea: "fr", project: "zh-CN", global: "de" }),
    { tag: "fr", source: "idea" },
  );
  assert.deepEqual(
    resolveLanguage({ project: "zh-CN", global: "de" }),
    { tag: "zh-CN", source: "project" },
  );
  assert.deepEqual(
    resolveLanguage({ global: "de" }),
    { tag: "de", source: "global" },
  );
  assert.deepEqual(
    resolveLanguage(),
    { tag: DEFAULT_LANGUAGE, source: "default" },
  );
});

test("resolves output independently from arbitrary content languages", () => {
  assert.deepEqual(
    resolveOutputLanguage({ content: "fr-FR" }),
    { tag: "en-US", source: "content" },
  );
  assert.deepEqual(
    resolveOutputLanguage({ content: "zh-Hant" }),
    { tag: "zh-CN", source: "content" },
  );
  assert.deepEqual(
    resolveOutputLanguage({ content: "fr-FR", override: "zh-cn" }),
    { tag: "zh-CN", source: "override" },
  );
  assert.deepEqual(
    resolveOutputLanguage(),
    { tag: DEFAULT_LANGUAGE, source: "default" },
  );
});
