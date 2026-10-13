import assert from "node:assert/strict";
import { test } from "node:test";
import jsonata from "jsonata";
import {
  createObjectiveLoader, ObjectiveConfigurationError, ObjectiveOperationError,
  SUBJECT_PROJECTION_LIMITS,
} from "../../src/objective-guide/index.ts";
import type {
  CheckResult, ObjectiveCheck, ObjectiveGuideInstance, ObjectiveGuideManifest,
  ObjectiveLoaderOptions, ObjectivePageResource, ObjectiveResourceResolver,
} from "../../src/objective-guide/index.ts";
import { compileSubjectProjection } from "../../src/objective-guide/projection.ts";

const rootUri = "https://objectives.test/root/manifest.yaml";
const childUri = "https://objectives.test/child/manifest.yaml";
function manifest(overrides: Partial<ObjectiveGuideManifest> = {}): ObjectiveGuideManifest {
  return {
    schemaVersion: 1,
    domainSchema: { type: "object", required: ["root"], properties: { root: { type: "string" } }, additionalProperties: false },
    levels: [{ id: "unready", advancement: { checks: ["ready"] } }],
    defaultLanguage: "en-US",
    localizations: {
      "en-US": { content: "en-US/content.yaml", references: { source: "en-US/references/" } },
      "zh-CN": { content: "zh-CN/content.yaml", references: { source: "zh-CN/references/" } },
    },
    ...overrides,
  };
}
function content(config: ObjectiveGuideManifest, language: string) {
  return {
    title: language, description: `Objective ${language}`,
    terminal: { title: `Ready ${language}`, description: `Ready ${language}` },
    levels: Object.fromEntries(config.levels.map(({ id }) => [id, {
      title: `${id} ${language}`, description: `Waiting ${language}`, outcome: `Cost and benefit ${language}`,
    }])),
  };
}
function page(id: string, body = "Reference text [[404]]") {
  return `---\nid: ${JSON.stringify(id)}\n---\n# ${id}\n\n${body}\n`;
}
function fixture(configs: Record<string, ObjectiveGuideManifest> = { [rootUri]: manifest() }, checks: Record<string, ObjectiveCheck> = {}) {
  const texts = new Map<string, string>();
  const pages = new Map<string, ObjectivePageResource[]>();
  const reads: string[] = [];
  for (const [uri, config] of Object.entries(configs)) {
    texts.set(uri, JSON.stringify(config));
    for (const [language, locale] of Object.entries(config.localizations)) {
      texts.set(new URL(locale.content, uri).href, JSON.stringify(content(config, language)));
      const source = new URL(locale.references.source, uri).href;
      pages.set(source, ["404", "problem"].map((id) => ({
        uri: new URL(`${id}.md`, source).href, source: page(id),
      })));
    }
  }
  const resources: ObjectiveResourceResolver = {
    async readText(uri) {
      reads.push(uri);
      const value = texts.get(uri);
      if (value === undefined) throw new Error(`Missing text ${uri}`);
      return value;
    },
    async readPages(uri) {
      const value = pages.get(uri);
      if (value === undefined) throw new Error(`Missing pages ${uri}`);
      return value;
    },
  };
  const options: ObjectiveLoaderOptions = {
    resources, checks: { ready: async () => ({ pass: true }), ...checks },
  };
  return { texts, pages, reads, options, loader: createObjectiveLoader(options) };
}
async function instance(context: ReturnType<typeof fixture>, language = "en-US"): Promise<ObjectiveGuideInstance> {
  const guide = await context.loader.load(rootUri);
  const created = guide.createInstance({ subject: { root: "project" }, language });
  if (!created.ok) assert.fail(JSON.stringify({ type: created.error.type }));
  return created.instance;
}

test("canonical URI identity is language-neutral and concurrent loads share a Guide", async () => {
  const context = fixture();
  const [first, second] = await Promise.all([
    context.loader.load(rootUri), context.loader.load("https://objectives.test/root/./manifest.yaml"),
  ]);
  assert.equal(first, second);
  assert.equal(context.reads.filter((uri) => uri === rootUri).length, 1);
  const en = await instance(context);
  const zh = await instance(context, "zh-CN");
  assert.notEqual(en, zh);
  assert.equal(en.guide, zh.guide);
  assert.equal(en.title, "en-US");
  assert.equal(zh.title, "zh-CN");
  assert.deepEqual(en.describeLevels().map(({ id }) => id), ["unready", "terminal"]);
  assert.equal(en.describeLevels()[0]?.advancementOutcome, "Cost and benefit en-US");
  assert.equal(en.describeLevels()[1]?.advancementOutcome, null);
  assert.equal(Object.hasOwn(en.describeLevels()[0]!, "level"), false);
});

test("instance subjects are immutable snapshots and default language is explicit", async () => {
  const context = fixture();
  const guide = await context.loader.load(rootUri);
  const subject = { root: "before" };
  const result = guide.createInstance({ subject });
  assert.equal(result instanceof Promise, false);
  if (!result.ok) assert.fail("Expected instance.");
  subject.root = "after";
  assert.equal(result.instance.subject.root, "before");
  assert.equal(result.instance.language, "en-US");
  assert.ok(Object.isFrozen(result.instance.subject));
  assert.ok(Object.isFrozen(result.instance));
  const unsupported = guide.createInstance({ subject, language: "en" });
  assert.equal(unsupported.ok, false);
  if (unsupported.ok || unsupported.error.type !== "unsupported-language") assert.fail("Expected typed language failure.");
  assert.equal(unsupported.error.guide, guide);
  assert.deepEqual(unsupported.error.chain, [guide]);
  assert.deepEqual(unsupported.error.supportedLanguages, ["en-US", "zh-CN"]);
});

test("subject schema failure is typed without mutation, coercion or defaults", async () => {
  const guide = await fixture().loader.load(rootUri);
  const subject = { root: 5 };
  const result = guide.createInstance({ subject });
  if (result.ok || result.error.type !== "invalid-subject") assert.fail("Expected typed schema failure.");
  assert.equal(result.error.subject, subject);
  assert.equal(result.error.issues[0].instancePath, "/root");
  assert.equal(result.error.issues[0].keyword, "type");
  assert.equal(subject.root, 5);
});

test("ordered checks stop at first failure, probe afresh and return direct page references", async () => {
  const calls: string[] = [];
  let passing = false;
  const config = manifest({ levels: [
    { id: "one", advancement: { checks: ["first"] } },
    { id: "two", advancement: { checks: ["second"] } },
  ] });
  const context = fixture({ [rootUri]: config }, {
    first: async (subject, language) => {
      calls.push(`${subject.root}/${language}`);
      return passing ? { pass: true } : { pass: false, problems: [{ pageId: "problem", description: "Fix it" }] };
    },
    second: async () => { calls.push("second"); return { pass: true }; },
  });
  const current = await instance(context);
  const observation = await current.probe();
  assert.equal(observation.current.instance, current);
  assert.equal(observation.current.id, "one");
  assert.equal(observation.gapSummary, "Fix it");
  assert.equal((await observation.current.instance.readPage(observation.problems[0]!.pageId)).id, "problem");
  assert.deepEqual(calls, ["project/en-US"]);
  passing = true;
  assert.equal((await current.probe()).current.id, "terminal");
  assert.deepEqual(calls, ["project/en-US", "project/en-US", "second"]);
});

test("prerequisites compose descriptions, project subject and skip local checks until terminal", async () => {
  const calls: string[] = [];
  let ready = false;
  const root = manifest({ prerequisite: { manifestUri: "../child/manifest.yaml", subject: '{"root": root}' } });
  const child = manifest({ levels: [{ id: "child-unready", advancement: { checks: ["child"] } }] });
  const context = fixture({ [rootUri]: root, [childUri]: child }, {
    ready: async () => { calls.push("root"); return { pass: true }; },
    child: async (subject) => {
      calls.push(String(subject.root));
      return ready ? { pass: true } : { pass: false, problems: [{ pageId: "problem", description: "Prerequisite first" }] };
    },
  });
  const current = await instance(context, "zh-CN");
  const childGuide = await context.loader.load(childUri);
  assert.equal(current.prerequisite?.guide, childGuide);
  assert.equal(current.prerequisite?.language, "zh-CN");
  assert.deepEqual(current.describeLevels().map(({ id }) => id), ["child-unready", "unready", "terminal"]);
  const sample = await current.probe();
  assert.equal(sample.current.instance, current.prerequisite);
  assert.deepEqual(calls, ["project"]);
  ready = true;
  assert.equal((await current.probe()).current.instance, current);
  assert.deepEqual(calls, ["project", "project", "root"]);
});

test("chain subject and language failures carry direct Guide objects", async () => {
  const root = manifest({ prerequisite: { manifestUri: childUri, subject: '{"root": 5}' } });
  const context = fixture({ [rootUri]: root, [childUri]: manifest() });
  const guide = await context.loader.load(rootUri);
  const result = guide.createInstance({ subject: { root: "project" } });
  if (result.ok || result.error.type !== "invalid-prerequisite-subject") assert.fail("Expected prerequisite failure.");
  assert.equal(result.error.failure.type, "validation-failed");
  assert.deepEqual(result.error.chain, [guide, guide.prerequisite!.guide]);
  const child = manifest({ defaultLanguage: "en-US", localizations: {
    "en-US": { content: "en-US/content.yaml", references: { source: "en-US/references/" } },
  } });
  const languageContext = fixture({
    [rootUri]: manifest({ prerequisite: { manifestUri: childUri, subject: '{"root": root}' } }),
    [childUri]: child,
  });
  const languageGuide = await languageContext.loader.load(rootUri);
  const unsupported = languageGuide.createInstance({ subject: { root: "project" }, language: "zh-CN" });
  if (unsupported.ok || unsupported.error.type !== "unsupported-language") assert.fail("Expected chain language failure.");
  assert.equal(unsupported.error.guide, languageGuide.prerequisite!.guide);
  assert.deepEqual(unsupported.error.chain, [languageGuide, languageGuide.prerequisite!.guide]);
});

test("projection profile rejects dynamic capabilities and bounds execution/output", async () => {
  for (const expression of ['$now()', '$random()', '$eval(root)', '$map(root, function($x){$x})', '($x := root; $x)']) {
    assert.throws(() => compileSubjectProjection(expression), ObjectiveConfigurationError);
  }
  assert.throws(() => compileSubjectProjection(" ".repeat(SUBJECT_PROJECTION_LIMITS.expressionBytes + 1)), /expression limit/);
  const project = compileSubjectProjection('{"root": root, "n": count + 1}');
  assert.deepEqual(project({ root: "project", count: 2 }), { root: "project", n: 3 });
  assert.throws(() => compileSubjectProjection("$")({ huge: "x".repeat(SUBJECT_PROJECTION_LIMITS.outputBytes) }), /bounded/);
  const context = fixture({
    [rootUri]: manifest({ prerequisite: { manifestUri: childUri, subject: '{"root": count / 0}' } }),
    [childUri]: manifest(),
  });
  const guide = await context.loader.load(rootUri);
  const failed = guide.createInstance({ subject: { root: "project" } });
  if (failed.ok || failed.error.type !== "invalid-prerequisite-subject") assert.fail("Expected projection failure.");
  assert.equal(failed.error.failure.type, "projection-failed");
});

test("404 defaults, overrides, search and shared link cycles retain page identity", async () => {
  const context = fixture();
  const current = await instance(context);
  assert.equal((await current.readPage("missing")).id, "404");
  assert.equal((await current.readPage("problem")).id, "problem");
  assert.deepEqual(await current.searchPages("no-such-text"), []);
  assert.deepEqual(Object.keys((await current.searchPages("Reference"))[0]!), ["id", "title"]);
  assert.deepEqual(Object.keys(await current.readPage("404")), ["id", "title", "content"]);
  const config = manifest({ localizations: {
    "en-US": { content: "content.yaml", references: { source: "refs/", notFoundPageId: "problem" } },
  } });
  assert.equal((await (await instance(fixture({ [rootUri]: config }))).readPage("missing")).id, "problem");
});

test("loader rejects missing or mismatched defaults, duplicate IDs, empty pages and dangling links", async () => {
  for (const mutate of [
    (pages: ObjectivePageResource[]) => pages.filter(({ uri }) => !uri.endsWith("404.md")),
    (pages: ObjectivePageResource[]) => pages.map((resource) => resource.uri.endsWith("404.md")
      ? { ...resource, source: page("not-404") } : resource),
    (pages: ObjectivePageResource[]) => [...pages, { uri: rootUri + ".md", source: page("problem") }],
    (pages: ObjectivePageResource[]) => pages.map((resource) => ({ ...resource, source: page("404", "[[missing]]") })),
    (pages: ObjectivePageResource[]) => pages.map((resource) => ({ ...resource, source: "---\nid: 404\n---\n" })),
  ]) {
    const context = fixture();
    const source = new URL("en-US/references/", rootUri).href;
    context.pages.set(source, mutate(context.pages.get(source)!));
    await assert.rejects(context.loader.load(rootUri), ObjectiveConfigurationError);
  }
});

test("loader rejects malformed structures, unsafe schemas, incomplete locales and cycles", async () => {
  for (const patch of [
    { levels: [] }, { levels: [{ id: "terminal", advancement: { checks: [] } }] },
    { domainSchema: { type: "object", $ref: "https://remote.test/schema" } },
    { domainSchema: { type: "string" } }, { defaultLanguage: "en-us" },
  ]) {
    const context = fixture();
    context.texts.set(rootUri, JSON.stringify({ ...manifest(), ...patch }));
    await assert.rejects(context.loader.load(rootUri), ObjectiveConfigurationError);
  }
  const context = fixture();
  const uri = new URL("en-US/content.yaml", rootUri).href;
  context.texts.set(uri, JSON.stringify({ ...content(manifest(), "en-US"), levels: {} }));
  await assert.rejects(context.loader.load(rootUri), /cover exactly/);
  const cyclic = fixture({ [rootUri]: manifest({ prerequisite: { manifestUri: rootUri, subject: "$" } }) });
  await assert.rejects(cyclic.loader.load(rootUri), /Cyclic prerequisite/);
  const mutual = fixture({
    [rootUri]: manifest({ prerequisite: { manifestUri: childUri, subject: "$" } }),
    [childUri]: manifest({ prerequisite: { manifestUri: rootUri, subject: "$" } }),
  });
  await assert.rejects(mutual.loader.load(rootUri), /Cyclic prerequisite/);
});

test("operation and resource errors propagate rather than masquerading as low levels or 404", async () => {
  const error = new Error("permission denied");
  const context = fixture({}, {});
  await assert.rejects(createObjectiveLoader({
    resources: { ...context.options.resources!, readText: async () => { throw error; } },
  }).load(rootUri), (caught) => caught === error);
  const failed = await instance(fixture(undefined, { ready: async () => { throw error; } }));
  await assert.rejects(failed.probe(), (caught) => caught === error);
  const invalid = { pass: false, problems: [] };
  const malformed = await instance(fixture(undefined, {
    ready: async () => invalid as CheckResult,
  }));
  await assert.rejects(malformed.probe(), ObjectiveOperationError);
});

test("local schema references work without treating JSON field names as schema keywords", async () => {
  const context = fixture({ [rootUri]: manifest({
    domainSchema: { type: "object", required: ["root"],
      $defs: { path: { type: "string" } },
      properties: { root: { $ref: "#/$defs/path" }, $id: { type: "string" } },
      additionalProperties: false },
  }) });
  const guide = await context.loader.load(rootUri);
  assert.equal(guide.createInstance({ subject: { root: "project", $id: "ordinary data" } }).ok, true);
});

test("root language wins over prerequisite language, but subject errors precede all languages", async () => {
  const onlyEnglish = manifest({ localizations: { "en-US": manifest().localizations["en-US"]! } });
  const context = fixture({
    [rootUri]: { ...onlyEnglish, prerequisite: { manifestUri: childUri, subject: '{"root": root}' } },
    [childUri]: onlyEnglish,
  });
  const guide = await context.loader.load(rootUri);
  const language = guide.createInstance({ subject: { root: "project" }, language: "zh-CN" });
  if (language.ok || language.error.type !== "unsupported-language") assert.fail("Expected language failure.");
  assert.equal(language.error.guide, guide);
  const invalid = guide.createInstance({ subject: {}, language: "zh-CN" });
  if (invalid.ok) assert.fail("Expected subject failure.");
  assert.equal(invalid.error.type, "invalid-subject");
});

test("projection bounds are enforced at their exact byte and time thresholds", () => {
  const projection = compileSubjectProjection("$");
  assert.deepEqual(projection({ x: "a".repeat(SUBJECT_PROJECTION_LIMITS.outputBytes - 8) }),
    { x: "a".repeat(SUBJECT_PROJECTION_LIMITS.outputBytes - 8) });
  assert.throws(() => projection({ x: "a".repeat(SUBJECT_PROJECTION_LIMITS.outputBytes - 7) }), /bounded/);
  assert.deepEqual(compileSubjectProjection(" ".repeat(SUBJECT_PROJECTION_LIMITS.expressionBytes - 1) + "$")({}), {});
  assert.throws(() => compileSubjectProjection('{"x":'.repeat(40) + "1" + "}".repeat(40)), /AST/);
  const descriptor = Object.getOwnPropertyDescriptor(performance, "now");
  let reads = 0;
  Object.defineProperty(performance, "now", { configurable: true, value: () => reads++ === 0 ? 0 : SUBJECT_PROJECTION_LIMITS.milliseconds + 1 });
  try {
    assert.throws(() => projection({}), /execution limit/);
  } finally {
    if (descriptor === undefined) Reflect.deleteProperty(performance, "now");
    else Object.defineProperty(performance, "now", descriptor);
  }
});

test("allowed JSONata projections preserve sequence and nested-array semantics", async () => {
  for (const expression of ['{"items": rows.name}', '{"items": [[root, 2]]}', '{"path": root & "/next"}']) {
    const subject = { root: "project", rows: [{ name: "one" }] };
    assert.deepEqual(compileSubjectProjection(expression)(subject), JSON.parse(JSON.stringify(await jsonata(expression).evaluate(subject))));
  }
});

test("non-JSON subjects fail before accessing properties with getters", async () => {
  let reads = 0;
  const subject = Object.defineProperty({}, "root", { enumerable: true, get() { reads++; return "project"; } });
  const guide = await fixture().loader.load(rootUri);
  const result = guide.createInstance({ subject });
  if (result.ok) assert.fail("Expected typed subject failure.");
  assert.equal(result.error.type, "invalid-subject");
  assert.equal(reads, 0);
  const hidden = Object.defineProperty({}, "root", { value: "project" });
  const hiddenResult = guide.createInstance({ subject: hidden });
  if (hiddenResult.ok) assert.fail("Expected non-enumerable subject failure.");
  assert.equal(hiddenResult.error.type, "invalid-subject");
});

test("an invalid configured check resolver cannot silently fall back to global checks", async () => {
  const context = fixture();
  Object.defineProperty(context.options, "resolveChecks", { value: () => undefined });
  await assert.rejects(createObjectiveLoader(context.options).load(rootUri), /owned function map/);
});

test("JSON subjects reject sparse or decorated arrays and proxies without invoking traps", async () => {
  const guide = await fixture({ [rootUri]: manifest({ domainSchema: { type: "object" } }) }).loader.load(rootUri);
  class CustomArray extends Array {}
  const proxy = new Proxy({}, { getPrototypeOf() { assert.fail("Proxy trap must not run."); } });
  for (const subject of [
    { items: new Array(1) }, { items: Object.assign([], { extra: "discarded by JSON" }) },
    { items: new CustomArray() }, proxy, { nested: proxy },
  ]) {
    const result = guide.createInstance({ subject });
    if (result.ok) assert.fail("Expected typed non-JSON failure.");
    assert.equal(result.error.type, "invalid-subject");
  }
  assert.equal(guide.createInstance({ subject: { items: [null, { value: 1 }] } }).ok, true);
});
