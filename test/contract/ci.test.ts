import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

import { parseDocument } from "yaml";

import { CHECK_SCRIPTS } from "../../bin/run-checks.ts";

const packageUrl = new URL("../../package.json", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/ci.yml", import.meta.url);
const suites = {
  unit: "test:unit",
  runtime: "test:unit",
  contract: "test:contract:built",
  integration: "test:integration:built",
  "integration-extended": "test:integration:extended:built",
  "integration-live": "test:integration:live:built",
  e2e: "test:e2e:built",
};

type DataRecord = Record<string, unknown>;

interface WorkflowStep extends DataRecord {
  name?: unknown;
}

interface WorkflowJob extends DataRecord {
  steps: WorkflowStep[];
}

function assertRecord(value: unknown): asserts value is DataRecord {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
}

function record(value: unknown): DataRecord {
  assertRecord(value);
  return value;
}

function assertJob(value: unknown): asserts value is WorkflowJob {
  assertRecord(value);
  assert.ok(Array.isArray(value.steps));
  for (const candidate of value.steps) assertRecord(candidate);
}

function job(value: unknown): WorkflowJob {
  assertJob(value);
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") assert.fail("expected string");
  return value;
}

function step(jobValue: WorkflowJob, name: string): WorkflowStep {
  const found = jobValue.steps.find((candidate) => candidate.name === name);
  assert.ok(found, `workflow job must include step: ${name}`);
  return found;
}

function assertSanityGate(unit: WorkflowJob) {
  const sanity = step(unit, "Run sanity checks");
  assert.ok(sanity, "unit matrix must run the actual sanity entrypoint");
  assert.equal(sanity.run, "pnpm check:sanity");
  assert.equal(sanity.if, undefined, "sanity must be unconditional");
  assert.equal(sanity["continue-on-error"], undefined, "sanity failure must fail CI");
  assert.ok(
    unit.steps.indexOf(sanity) < unit.steps.indexOf(step(unit, "Run unit tests")),
    "sanity must run before the complete unit/runtime suite",
  );
}

test("runs fast layered validation in ordinary CI", async () => {
  const [manifestSource, workflowSource] = await Promise.all([
    readFile(packageUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
  ]);
  const manifest = record(JSON.parse(manifestSource));
  const scripts = record(manifest.scripts);
  const document = parseDocument(workflowSource);
  assert.deepEqual(document.errors, []);

  assert.equal(
    scripts.test,
    "npm run test:unit && npm run test:contract",
  );
  assert.equal(scripts.check, "node bin/run-checks.ts");
  assert.equal(scripts["check:release"], "node bin/run-checks.ts --tier release");
  assert.equal(scripts["test:unit"], 'node --test "test/unit/*.test.ts" "test/runtime/*.test.ts"');
  assert.equal(
    scripts["test:integration:all:built"],
    'node --test "test/integration/*.test.ts" "test/integration-extended/*.test.ts"',
  );
  assert.equal(
    scripts["test:integration:live:built"],
    'node --test "test/integration-live/*.test.ts"',
  );
  assert.match(
    text(scripts["test:integration:platform:built"]),
    /test\/integration\/git\.test\.ts test\/integration-extended\/incremental-append\.test\.ts$/,
  );
  assert.equal(scripts["check:skills"], "npm run check:skills:discover");
  assert.equal(Object.hasOwn(scripts, "check:skills:local"), false);
  assert.equal(scripts["check:skills:discover"], "npx skills add . --list");
  assert.deepEqual(CHECK_SCRIPTS, [
    "typecheck",
    "build",
    "lint:markdown",
    "check:pure",
    "check:quick",
    "test:integration:all:built",
    "pack:check:built",
    "test:e2e:built",
    "check:skills",
  ]);

  const workflow = record(document.toJS());
  const jobs = record(workflow.jobs);
  assert.deepEqual(Object.keys(jobs).sort(), [
    "contract",
    "integration",
    "integration-extended",
    "package",
    "package-risk",
    "required",
    "unit",
  ]);

  const unit = job(jobs.unit);
  const contract = job(jobs.contract);
  const integration = job(jobs.integration);
  const extendedIntegration = job(jobs["integration-extended"]);
  const required = job(jobs.required);
  assert.deepEqual(record(unit.strategy).matrix, {
    os: ["ubuntu-latest", "windows-latest", "macos-latest"],
    node: [22, 24],
  });
  assertSanityGate(unit);
  assert.equal(step(unit, "Run unit tests").run, "pnpm test:unit");
  assert.equal(
    step(unit, "Run platform integration smoke").run,
    "pnpm test:integration:platform:built",
  );

  assert.equal(contract["runs-on"], "ubuntu-latest");
  assert.equal(record(step(contract, "Set up Node.js").with)["node-version"], 24);
  assert.equal(step(contract, "Run contract tests").run, "pnpm test:contract");
  assert.equal(step(contract, "Discover skills").run, "pnpm check:skills");
  assert.equal(step(contract, "Lint Markdown").run, "pnpm lint:markdown");
  assert.equal(step(contract, "Check whitespace").run, "pnpm check:diff");
  assert.equal(record(step(contract, "Check out repository").with)["fetch-depth"], 0);
  assert.equal(step(contract, "Validate checked-out Silvermoon snapshot").run,
    "git remote set-url origin https://github.com/shazhou-ww/silvermoon.git\n"
    + "git fetch --no-tags origin main\n"
    + "node bin/silvermoon.ts check --commit HEAD --audience agent\n");

  assert.equal(integration["runs-on"], "ubuntu-latest");
  assert.equal(record(step(integration, "Set up Node.js").with)["node-version"], 24);
  assert.equal(
    step(integration, "Run fast integration tests").run,
    "pnpm test:integration",
  );
  assert.equal(extendedIntegration["runs-on"], "ubuntu-latest");
  assert.equal(
    extendedIntegration.if,
    "github.event_name != 'pull_request'",
  );
  assert.equal(
    record(step(extendedIntegration, "Set up Node.js").with)["node-version"],
    24,
  );
  assert.equal(
    step(extendedIntegration, "Run extended integration tests").run,
    "pnpm test:integration:extended",
  );

  for (const job of [unit, contract, integration]) {
    assert.equal(job.if, undefined);
    assert.equal(job.needs, undefined);
    assert.ok(job.steps.every((candidate) => candidate.if === undefined));
  }
  const risk = job(jobs["package-risk"]);
  assert.equal(record(step(risk, "Check out full history").with)["fetch-depth"], 0);
  assert.equal(record(risk.outputs).required, "${{ steps.risk.outputs.required }}");
  const riskEnvironment = record(step(risk, "Observe package risk").env);
  assert.equal(riskEnvironment.BASE_SHA, "${{ github.event.pull_request.base.sha || github.event.before }}");
  assert.equal(riskEnvironment.HEAD_SHA, "${{ github.sha }}");
  assert.match(text(step(risk, "Observe package risk").run), /--base "\$BASE_SHA" --head "\$HEAD_SHA"/);
  assert.match(text(step(risk, "Observe package risk").run), /else\s+node bin\/ci-package-risk\.ts --full/);
  const packaged = job(jobs.package);
  assert.equal(packaged.needs, "package-risk");
  assert.equal(packaged.if, "needs.package-risk.outputs.required == 'true'");
  assert.equal(step(packaged, "Verify package contents").run, "pnpm pack:check");
  assert.equal(step(packaged, "Test installed package").run, "pnpm test:e2e");
  assert.equal(required.name, "Required checks");
  assert.equal(required.if, "${{ always() }}");
  assert.deepEqual(required.needs, [
    "package-risk",
    "unit",
    "contract",
    "integration",
    "integration-extended",
    "package",
  ]);
  assert.equal(required["runs-on"], "ubuntu-latest");
  assert.equal(required["timeout-minutes"], 5);
  const requiredGate = step(required, "Verify required jobs");
  assert.deepEqual(requiredGate.env, {
    EVENT_NAME: "${{ github.event_name }}",
    PACKAGE_REQUIRED: "${{ needs.package-risk.outputs.required }}",
    PACKAGE_RISK_RESULT: "${{ needs.package-risk.result }}",
    UNIT_RESULT: "${{ needs.unit.result }}",
    CONTRACT_RESULT: "${{ needs.contract.result }}",
    INTEGRATION_RESULT: "${{ needs.integration.result }}",
    EXTENDED_INTEGRATION_RESULT: "${{ needs.integration-extended.result }}",
    PACKAGE_RESULT: "${{ needs.package.result }}",
  });
  assert.match(text(requiredGate.run), /true:success\|false:skipped/);
  assert.match(
    text(requiredGate.run),
    /pull_request:skipped\|schedule:success\|workflow_dispatch:success/,
  );
  assert.match(text(requiredGate.run), /Required CI job result was \$result/);
  assert.equal(requiredGate["continue-on-error"], undefined);
  assert.deepEqual(workflow.permissions, { contents: "read" });
});

test("CI contract rejects absent, bypassed or non-blocking sanity validation", async () => {
  const workflow = record(parseDocument(await readFile(workflowUrl, "utf8")).toJS());
  const jobs = record(workflow.jobs);
  const mutations: Array<(unit: WorkflowJob) => void> = [
    (unit) => { unit.steps = unit.steps.filter(({ name }) => name !== "Run sanity checks"); },
    (unit) => { step(unit, "Run sanity checks").run = "node --check bin/silvermoon.js"; },
    (unit) => { step(unit, "Run sanity checks").run = "pnpm test:unit"; },
    (unit) => { step(unit, "Run sanity checks").if = "false"; },
    (unit) => { step(unit, "Run sanity checks")["continue-on-error"] = true; },
    (unit) => {
      const sanity = step(unit, "Run sanity checks");
      unit.steps = unit.steps.filter((candidate: unknown) => candidate !== sanity);
      unit.steps.push(sanity);
    },
  ];
  for (const mutate of mutations) {
    const unit = structuredClone(job(jobs.unit));
    mutate(unit);
    assert.throws(() => assertSanityGate(unit), { name: "AssertionError" });
  }
});

test("every test file belongs to an explicit suite", async () => {
  const manifest = record(JSON.parse(await readFile(packageUrl, "utf8")));
  const scripts = record(manifest.scripts);
  const root = new URL("../", import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const files = entries.filter((path) => /\.test\.ts$/.test(path));
  assert.ok(files.length > 0);
  for (const file of files) {
    const directory = file.split(/[\\/]/)[0];
    if (directory === undefined) assert.fail(`Test path has no directory: ${file}`);
    assert.ok(isSuiteDirectory(directory), `Unassigned test: ${file}`);
    assert.ok(text(scripts[suites[directory]]).includes(`test/${directory}/*.test.ts`), file);
  }
});

function isSuiteDirectory(value: string): value is keyof typeof suites {
  return Object.hasOwn(suites, value);
}
