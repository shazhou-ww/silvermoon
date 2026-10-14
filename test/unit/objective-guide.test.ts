import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { test } from "node:test";
import {
  createObjectiveLoader, ObjectiveConfigurationError, ObjectiveOperationError,
  SUBJECT_PROJECTION_LIMITS,
} from "../../src/objective-guide/index.ts";
import type {
  CheckRequest, CheckResult, ObjectiveGuideInstance, ObjectiveGuideManifest,
  ObjectivePageResource, ObjectiveResourceResolver,
} from "../../src/objective-guide/index.ts";
import { compileSubjectProjection } from "../../src/objective-guide/projection.ts";

const rootUri = "https://objectives.test/root/manifest.yaml";
const childUri = "https://objectives.test/child/manifest.yaml";
type Handler = (request: CheckRequest) => Promise<CheckResult>;

function manifest(overrides: Partial<ObjectiveGuideManifest> = {}): ObjectiveGuideManifest {
  return {
    schemaVersion: 1,
    domainSchema: {
      type: "object", required: ["root"],
      properties: { root: { type: "string" } }, additionalProperties: false,
    },
    levels: [{ id: "unready", advancement: { checks: ["ready"] } }],
    defaultLanguage: "en-US",
    languages: ["en-US", "zh-CN"],
    ...overrides,
  };
}
function markdown(properties: Record<string, string>, body = "") {
  return `---\n${Object.entries(properties).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n${body}\n`;
}
function fixture(
  configs: Record<string, ObjectiveGuideManifest> = { [rootUri]: manifest() },
  handlers: Record<string, Handler> = {},
) {
  const texts = new Map<string, string>();
  const pages = new Map<string, ObjectivePageResource[]>();
  const reads: string[] = [];
  for (const [uri, config] of Object.entries(configs)) {
    texts.set(uri, JSON.stringify(config));
    const source = new URL("references/", uri).href;
    const resources: ObjectivePageResource[] = [];
    const add = (id: string, language: string, properties: Record<string, string>, body = "") => {
      resources.push({ uri: new URL(`${id}/${language}.md`, source).href, source: markdown(properties, body) });
    };
    for (const language of config.languages) {
      add("system/overview", language, { title: language, description: `Objective ${language}` });
      add("system/404", language, { title: `Missing ${language}`, description: `Missing ${language}` });
      add("levels/terminal", language, { title: `Ready ${language}`, description: `Ready ${language}` });
      for (const level of config.levels) {
        add(`levels/${level.id}`, language, {
          title: `${level.id} ${language}`,
          description: `Waiting ${language}`,
          outcome: `Cost and benefit ${language}`,
        });
        for (const id of level.advancement.checks) add(`checks/${id}`, language, {
          title: id, description: `Check ${id} ${language}`,
        });
      }
      add("problems/problem", language, {
        title: `Problem ${language}`, description: `Fix it ${language}`,
      }, "[[system/404]]");
    }
    pages.set(source, resources);
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
  const loader = createObjectiveLoader({
    resources,
    checkRunner: {
      async run(_uri, id, request) {
        return await (handlers[id] ?? (async () => ({ pass: true } as const)))(request);
      },
    },
  });
  return { texts, pages, reads, resources, loader };
}
async function instance(context: ReturnType<typeof fixture>, language = "en-US"): Promise<ObjectiveGuideInstance> {
  const guide = await context.loader.load(rootUri);
  const created = guide.createInstance({ subject: { root: "project" }, language });
  if (!created.ok) assert.fail(JSON.stringify({ type: created.error.type }));
  return created.instance;
}

test("canonical identity is language-neutral and References provide descriptions", async () => {
  const context = fixture();
  const [first, second] = await Promise.all([
    context.loader.load(rootUri), context.loader.load("https://objectives.test/root/./manifest.yaml"),
  ]);
  assert.equal(first, second);
  assert.equal(context.reads.filter((uri) => uri === rootUri).length, 1);
  const en = await instance(context);
  const zh = await instance(context, "zh-CN");
  assert.equal(en.guide, zh.guide);
  assert.equal(en.title, "en-US");
  assert.equal(zh.title, "zh-CN");
  assert.deepEqual(en.describeLevels().map(({ id }) => id), ["unready", "terminal"]);
  assert.equal(en.describeLevels()[0]?.advancementOutcome, "Cost and benefit en-US");
  assert.equal((await en.readPage("missing")).id, "system/404");
  assert.deepEqual(await en.searchPages("fix it"), [{ id: "problems/problem", title: "Problem en-US" }]);
});

test("instance subjects are immutable and schema/language failures remain typed", async () => {
  const guide = await fixture().loader.load(rootUri);
  const subject = { root: "before" };
  const result = guide.createInstance({ subject });
  if (!result.ok) assert.fail("Expected instance.");
  subject.root = "after";
  assert.equal(result.instance.subject.root, "before");
  assert.ok(Object.isFrozen(result.instance.subject));
  const invalid = guide.createInstance({ subject: { root: 5 } });
  if (invalid.ok || invalid.error.type !== "invalid-subject") assert.fail("Expected subject failure.");
  const unsupported = guide.createInstance({ subject: { root: "x" }, language: "en" });
  if (unsupported.ok || unsupported.error.type !== "unsupported-language") assert.fail("Expected language failure.");
});

test("position identifies the owner, failing check and complete ordered Problems", async () => {
  const calls: string[] = [];
  const directories: string[] = [];
  let passing = false;
  const config = manifest({ levels: [
    { id: "one", advancement: { checks: ["first"] } },
    { id: "two", advancement: { checks: ["second"] } },
  ] });
  const context = fixture({ [rootUri]: config }, {
    first: async (request) => {
      calls.push("first");
      directories.push(request.probe.tempDirectory);
      return passing ? { pass: true } : {
        pass: false, problems: [
          { id: "problem", parameters: { path: "first" } },
          { id: "problem", parameters: { path: "second" } },
        ],
      };
    },
    second: async (request) => {
      calls.push("second");
      directories.push(request.probe.tempDirectory);
      return { pass: true };
    },
  });
  const current = await instance(context);
  const failed = await current.probe();
  assert.equal(failed.position.owner, current);
  assert.equal(failed.position.level.id, "one");
  assert.equal(failed.position.level.instance, current);
  assert.equal(failed.position.failingCheck, "first");
  assert.equal(failed.gapSummary, "Fix it en-US\nFix it en-US");
  assert.deepEqual(failed.position.problems, [
    { id: "problem", parameters: { path: "first" } },
    { id: "problem", parameters: { path: "second" } },
  ]);
  assert.equal((await failed.position.owner.readPage(
    `problems/${failed.position.problems[0]!.id}`,
  )).id, "problems/problem");
  await assert.rejects(stat(directories[0]!));
  passing = true;
  const terminal = await current.probe();
  assert.equal(terminal.position.level.id, "terminal");
  assert.equal(terminal.position.owner, current);
  assert.equal(terminal.position.failingCheck, null);
  assert.deepEqual(terminal.position.problems, []);
  assert.deepEqual(calls, ["first", "first", "second"]);
  assert.equal(directories[1], directories[2]);
  assert.notEqual(directories[0], directories[1]);
  await assert.rejects(stat(directories[1]!));
});

test("prerequisite defaults to terminal and can unlock at a declared minimum level", async () => {
  let passFirst = false;
  const calls: string[] = [];
  const child = manifest({ levels: [
    { id: "configured", advancement: { checks: ["first"] } },
    { id: "synchronized", advancement: { checks: ["second"] } },
  ] });
  const root = manifest({ prerequisite: {
    manifestUri: childUri, subject: '{"root": root}', minimumLevelId: "synchronized",
  } });
  const context = fixture({ [rootUri]: root, [childUri]: child }, {
    first: async () => {
      calls.push("first");
      return passFirst ? { pass: true } : {
        pass: false, problems: [{ id: "problem", parameters: {} }],
      };
    },
    second: async () => { calls.push("second"); return { pass: false, problems: [{ id: "problem", parameters: {} }] }; },
    ready: async () => { calls.push("root"); return { pass: true }; },
  });
  const current = await instance(context);
  assert.deepEqual(current.describeLevels().map(({ id }) => id), ["configured", "unready", "terminal"]);
  const prerequisiteFailure = await current.probe();
  assert.equal(prerequisiteFailure.position.level.id, "configured");
  assert.equal(prerequisiteFailure.position.owner, current.prerequisite);
  assert.equal(prerequisiteFailure.position.failingCheck, "first");
  passFirst = true;
  const sample = await current.probe();
  assert.equal(sample.position.owner, current);
  assert.equal(sample.position.level.id, "terminal");
  assert.deepEqual(calls, ["first", "first", "second", "root"]);

  const terminalContext = fixture({
    [rootUri]: manifest({ prerequisite: { manifestUri: childUri, subject: '{"root": root}' } }),
    [childUri]: child,
  }, {
    first: async () => ({ pass: true }),
    second: async () => ({ pass: false, problems: [{ id: "problem", parameters: {} }] }),
  });
  const terminalPrerequisite = await instance(terminalContext);
  const blocked = await terminalPrerequisite.probe();
  assert.equal(blocked.position.level.id, "synchronized");
  assert.equal(blocked.position.owner, terminalPrerequisite.prerequisite);
  assert.equal(blocked.position.failingCheck, "second");
});

test("invalid minimum levels, malformed References and unknown Problems fail explicitly", async () => {
  const invalidMinimum = fixture({
    [rootUri]: manifest({ prerequisite: {
      manifestUri: childUri, subject: '{"root": root}', minimumLevelId: "missing",
    } }),
    [childUri]: manifest(),
  });
  await assert.rejects(invalidMinimum.loader.load(rootUri), /minimum level/);

  const missing = fixture();
  const source = new URL("references/", rootUri).href;
  missing.pages.set(source, missing.pages.get(source)!.filter(({ uri }) => !uri.includes("/system/404/")));
  await assert.rejects(missing.loader.load(rootUri), /Missing Reference|cover every language/);

  const unknown = await instance(fixture(undefined, {
    ready: async () => ({ pass: false, problems: [{ id: "missing", parameters: {} }] }),
  }));
  await assert.rejects(unknown.probe(), ObjectiveOperationError);
});

test("projection profile rejects dynamic capabilities and bounds execution/output", () => {
  for (const expression of ['$now()', '$random()', '$eval(root)', '$map(root, function($x){$x})', '($x := root; $x)']) {
    assert.throws(() => compileSubjectProjection(expression), ObjectiveConfigurationError);
  }
  assert.throws(() => compileSubjectProjection(" ".repeat(SUBJECT_PROJECTION_LIMITS.expressionBytes + 1)), /expression limit/);
  assert.deepEqual(compileSubjectProjection('{"root": root, "n": count + 1}')({ root: "project", count: 2 }),
    { root: "project", n: 3 });
});

test("resource and runner errors propagate instead of becoming low levels or 404", async () => {
  const error = new Error("permission denied");
  const context = fixture();
  await assert.rejects(createObjectiveLoader({
    resources: { ...context.resources, readText: async () => { throw error; } },
  }).load(rootUri), (caught) => caught === error);
  const failed = await instance(fixture(undefined, { ready: async () => { throw error; } }));
  await assert.rejects(failed.probe(), (caught) => caught === error);
  const malformed = await instance(fixture(undefined, {
    ready: async () => ({ pass: false, problems: [] } as unknown as CheckResult),
  }));
  await assert.rejects(malformed.probe(), ObjectiveOperationError);
});
