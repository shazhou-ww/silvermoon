import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { createCommandRun } from "../../src/foundation/command-message/index.ts";
import { isValidUlid } from "../../src/foundation/idea-model/index.ts";
import { validRepository } from "../../src/foundation/coordinates/index.ts";

async function readSchema(name: string) {
  return JSON.parse(
    await readFile(new URL(`../../schema/v1/${name}.schema.json`, import.meta.url), "utf8"),
  );
}

async function validators() {
  const [
    commandReport,
    definitions,
    domainMessage,
    config,
    ideaStatus,
    traceEvent,
    userConfig,
  ] = await Promise.all([
    readSchema("command-report"),
    readSchema("definitions"),
    readSchema("domain-message"),
    readSchema("config"),
    readSchema("idea-status"),
    JSON.parse(
      await readFile(
        new URL("../../schema/v2/trace-event.schema.json", import.meta.url),
        "utf8",
      ),
    ),
    readSchema("user-config"),
  ]);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    formats: { uri: true },
  });
  ajv.addSchema(definitions);
  return {
    commandReport: ajv.compile(commandReport),
    config: ajv.compile(config),
    definitions,
    domainMessage: ajv.compile(domainMessage),
    ideaStatus: ajv.compile(ideaStatus),
    traceEvent: ajv.compile(traceEvent),
    userConfig: ajv.compile(userConfig),
  };
}

test("publishes independently compilable version 1 schema entrypoints", async () => {
  const { config, definitions, ideaStatus, userConfig } = await validators();

  assert.equal(
    config({
      version: 1,
      primaryRepository: "https://example.com/owner/repository.git",
      primaryBranch: "main",
      preferredLanguage: "zh-CN",
    }),
    true,
    JSON.stringify(config.errors),
  );
  assert.equal(
    ideaStatus({
      version: 1,
      id: "01M36QGPNTXEPP61DA4KP4AVZF",
      alias: "publish-documentation",
      language: "zh-CN",
      approvedRevision: "a".repeat(40),
      implementationAcceptedRevision: "b".repeat(64),
    }),
    true,
    JSON.stringify(ideaStatus.errors),
  );
  assert.equal(
    userConfig({ version: 1, preferredLanguage: "zh-CN" }),
    true,
    JSON.stringify(userConfig.errors),
  );

  assert.equal(Object.hasOwn(definitions.$defs, "ideasDirectory"), false);
});

test("publishes command report, domain message, and trace event schemas", async () => {
  const { commandReport, domainMessage, traceEvent } = await validators();
  const intention = {
    command: "whats-next",
    args: { idea: null, language: null },
  };
  assert.equal(domainMessage({
    schemaVersion: 1,
    sequence: 1,
    type: "intention.accepted",
    intention,
  }), true, JSON.stringify(domainMessage.errors));
  assert.equal(commandReport({
    intention,
    observation: {
      state: "navigation-ready",
      problems: [],
    },
    actions: [],
    response: {
      kind: "choice-required",
      language: "en-US",
      summary: "Choose an idea.",
      nextSteps: [],
    },
  }), true, JSON.stringify(commandReport.errors));
  assert.equal(traceEvent({
    schemaVersion: 2,
    traceId: "d9428888-122b-4c26-b27c-00a0c5f20d11",
    sequence: 1,
    timestamp: "2026-09-29T00:00:00.000Z",
    channel: "domain",
    event: "intention.accepted",
    messageSequence: 1,
  }), true, JSON.stringify(traceEvent.errors));

  const runtime = createCommandRun(intention);
  runtime.observe({
    state: "project-setup-required",
    root: "C:\\repository",
    outputLanguage: "en-US",
    observedThrough: "ideas",
    problems: [],
  }, { factType: "project.snapshot" });
  const actionId = runtime.requestAction({ type: "fetch-primary" });
  runtime.finishAction(actionId, "fetch-primary", {
    status: "success",
    result: { commit: "a".repeat(40) },
  });
  const producedReport = runtime.complete(
    {
      state: "navigation-ready",
      root: "C:\\repository",
      version: { type: "worktree" },
      configuration: {
        primaryRepository: "https://example.com/owner/repository.git",
        primaryBranch: "main",
        preferredLanguage: "en-US",
      },
      outputLanguage: "en-US",
      ideas: { counts: {}, activeIdeas: [] },
      problems: [],
    },
    { nextSteps: "Create an idea." },
  );
  assert.equal(
    commandReport(producedReport),
    true,
    JSON.stringify(commandReport.errors),
  );
  for (const message of runtime.events) {
    assert.equal(
      domainMessage(message),
      true,
      JSON.stringify(domainMessage.errors),
    );
  }

  const listRuntime = createCommandRun({
    command: "list-ideas",
    args: {
      states: ["preparing", "implementing", "deploying"],
      query: null,
      createdSince: null,
      createdBefore: null,
      sort: "newest",
      limit: null,
    },
  });
  const listReport = listRuntime.complete({
    state: "ideas-listed",
    root: "C:\\repository",
    version: { type: "worktree" },
    configuration: {
      primaryRepository: "https://example.com/owner/repository.git",
      primaryBranch: "main",
      preferredLanguage: "en-US",
    },
    outputLanguage: "en-US",
    problems: [],
    summary: {
      matched: 0,
      returned: 0,
      counts: {
        preparing: 0,
        implementing: 0,
        deploying: 0,
        completed: 0,
        abandoned: 0,
      },
    },
    ideas: [],
  });
  assert.equal(
    commandReport(listReport),
    true,
    JSON.stringify(commandReport.errors),
  );
  for (const message of listRuntime.events) {
    assert.equal(
      domainMessage(message),
      true,
      JSON.stringify(domainMessage.errors),
    );
  }
});

test("rejects invalid repository configuration through its public schema", async () => {
  const { config } = await validators();
  const valid = {
    version: 1,
    primaryRepository: "https://example.com/owner/repository.git",
    primaryBranch: "main",
  };
  for (const candidate of [
    { ...valid, version: 2 },
    { version: 1, primaryRepository: valid.primaryRepository },
    { ...valid, primaryRepository: "http://example.com/owner/repository.git" },
    { ...valid, primaryBranch: "refs/heads/main" },
    { ...valid, preferredLanguage: "zh-cn" },
    { ...valid, ideasDirectory: "ideas" },
  ]) {
    assert.equal(config(candidate), false, JSON.stringify(candidate));
  }
});

test("rejects invalid idea status through its public schema", async () => {
  const { ideaStatus } = await validators();
  const valid = {
    version: 1,
    id: "01M36QGPNTXEPP61DA4KP4AVZF",
  };
  for (const candidate of [
    { version: 1 },
    { ...valid, version: 2 },
    { ...valid, id: valid.id.toLowerCase() },
    { ...valid, alias: " leading" },
    { ...valid, language: "zh-cn" },
    { ...valid, abandoned: false },
    { ...valid, approvedRevision: "a" },
    { ...valid, state: "preparing" },
  ]) {
    assert.equal(ideaStatus(candidate), false, JSON.stringify(candidate));
  }
});

test("rejects invalid user configuration through its public schema", async () => {
  const { userConfig } = await validators();
  for (const candidate of [
    {},
    { version: 2 },
    { version: 1, preferredLanguage: "zh-cn" },
    { version: 1, language: "zh-CN" },
  ]) {
    assert.equal(userConfig(candidate), false, JSON.stringify(candidate));
  }
});

test("keeps shared schema definitions aligned with runtime identity constraints", async () => {
  const { definitions } = await validators();
  const repositoryPattern = new RegExp(definitions.$defs.repository.pattern);
  for (const repository of [
    "https://example.com/owner/repository.git",
    "https://example.com:8443/Owner/Repository",
  ]) {
    assert.equal(repositoryPattern.test(repository), true, repository);
    assert.equal(validRepository(repository), true, repository);
  }
  for (const repository of [
    "http://example.com/owner/repository.git",
    "https://EXAMPLE.com/owner/repository.git",
    "https://example.com/owner/../repository.git",
  ]) {
    assert.equal(repositoryPattern.test(repository), false, repository);
    assert.equal(validRepository(repository), false, repository);
  }

  const ulidPattern = new RegExp(definitions.$defs.ulid.pattern);
  for (const value of ["01M36QGPNTXEPP61DA4KP4AVZF", "01M36QGPNTXEPP61DA4KP4AVG0"]) {
    assert.equal(ulidPattern.test(value), true, value);
    assert.equal(isValidUlid(value), true, value);
  }

  const objectIdPattern = new RegExp(definitions.$defs.objectId.pattern);
  assert.equal(objectIdPattern.test("a".repeat(40)), true);
  assert.equal(objectIdPattern.test("a".repeat(64)), true);
  assert.equal(objectIdPattern.test("A".repeat(40)), false);
});
