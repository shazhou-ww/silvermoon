import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

import { parseDocument } from "yaml";

import { CHECK_SCRIPTS } from "../../scripts/run-checks.mjs";

const packageUrl = new URL("../../package.json", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/ci.yml", import.meta.url);

function step(job, name) {
  return job.steps.find((candidate) => candidate.name === name);
}

function assertSanityGate(unit) {
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
  const manifest = JSON.parse(manifestSource);
  const document = parseDocument(workflowSource);
  assert.deepEqual(document.errors, []);

  assert.equal(
    manifest.scripts.test,
    "npm run test:unit && npm run test:contract",
  );
  assert.equal(manifest.scripts.check, "node scripts/run-checks.mjs");
  assert.equal(manifest.scripts["check:release"], "node scripts/run-checks.mjs --tier release");
  assert.equal(manifest.scripts["test:unit"], 'node --test "test/unit/*.test.*" "test/runtime/*.test.*"');
  assert.equal(manifest.scripts["check:skills"], "npm run check:skills:local && npm run check:skills:discover");
  assert.equal(manifest.scripts["check:skills:local"], "node scripts/sync-skills.mjs --check");
  assert.equal(manifest.scripts["check:skills:discover"], "npx skills add . --list");
  assert.deepEqual(CHECK_SCRIPTS, [
    "lint:markdown",
    "check:quick",
    "test:integration",
    "pack:check",
    "test:e2e",
    "check:skills",
  ]);

  const workflow = document.toJS();
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    "contract",
    "integration",
    "package",
    "package-risk",
    "required",
    "unit",
  ]);

  const { unit, contract, integration, required } = workflow.jobs;
  assert.deepEqual(unit.strategy.matrix, {
    os: ["ubuntu-latest", "windows-latest", "macos-latest"],
    node: [22, 24],
  });
  assertSanityGate(unit);
  assert.equal(step(unit, "Run unit tests").run, "pnpm test:unit");

  assert.equal(contract["runs-on"], "ubuntu-latest");
  assert.equal(step(contract, "Set up Node.js").with["node-version"], 24);
  assert.equal(step(contract, "Run contract tests").run, "pnpm test:contract");
  assert.equal(step(contract, "Discover skills").run, "pnpm check:skills");
  assert.equal(step(contract, "Lint Markdown").run, "pnpm lint:markdown");
  assert.equal(step(contract, "Check whitespace").run, "pnpm check:diff");
  assert.equal(step(contract, "Validate checked-out Silvermoon snapshot").run, "node bin/silvermoon.js check --commit HEAD --audience agent");

  assert.equal(integration["runs-on"], "ubuntu-latest");
  assert.equal(step(integration, "Set up Node.js").with["node-version"], 24);
  assert.equal(
    step(integration, "Run integration tests").run,
    "pnpm test:integration",
  );

  for (const job of [unit, contract, integration]) {
    assert.equal(job.if, undefined);
    assert.equal(job.needs, undefined);
    assert.ok(job.steps.every((candidate) => candidate.if === undefined));
  }
  const risk = workflow.jobs["package-risk"];
  assert.equal(step(risk, "Check out full history").with["fetch-depth"], 0);
  assert.equal(risk.outputs.required, "${{ steps.risk.outputs.required }}");
  assert.equal(step(risk, "Observe package risk").env.BASE_SHA, "${{ github.event.pull_request.base.sha || github.event.before }}");
  assert.equal(step(risk, "Observe package risk").env.HEAD_SHA, "${{ github.sha }}");
  assert.match(step(risk, "Observe package risk").run, /--base "\$BASE_SHA" --head "\$HEAD_SHA"/);
  assert.match(step(risk, "Observe package risk").run, /else\s+node scripts\/ci-package-risk\.mjs --full/);
  const packaged = workflow.jobs.package;
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
    "package",
  ]);
  assert.equal(required["runs-on"], "ubuntu-latest");
  assert.equal(required["timeout-minutes"], 5);
  const requiredGate = step(required, "Verify required jobs");
  assert.deepEqual(requiredGate.env, {
    PACKAGE_REQUIRED: "${{ needs.package-risk.outputs.required }}",
    PACKAGE_RISK_RESULT: "${{ needs.package-risk.result }}",
    UNIT_RESULT: "${{ needs.unit.result }}",
    CONTRACT_RESULT: "${{ needs.contract.result }}",
    INTEGRATION_RESULT: "${{ needs.integration.result }}",
    PACKAGE_RESULT: "${{ needs.package.result }}",
  });
  assert.match(requiredGate.run, /true:success\|false:skipped/);
  assert.match(requiredGate.run, /Required CI job result was \$result/);
  assert.equal(requiredGate["continue-on-error"], undefined);
  assert.deepEqual(workflow.permissions, { contents: "read" });
});

test("CI contract rejects absent, bypassed or non-blocking sanity validation", async () => {
  const workflow = parseDocument(await readFile(workflowUrl, "utf8")).toJS();
  for (const mutate of [
    (unit) => { unit.steps = unit.steps.filter(({ name }) => name !== "Run sanity checks"); },
    (unit) => { step(unit, "Run sanity checks").run = "node --check bin/silvermoon.js"; },
    (unit) => { step(unit, "Run sanity checks").run = "pnpm test:unit"; },
    (unit) => { step(unit, "Run sanity checks").if = "false"; },
    (unit) => { step(unit, "Run sanity checks")["continue-on-error"] = true; },
    (unit) => {
      const sanity = step(unit, "Run sanity checks");
      unit.steps = unit.steps.filter((candidate) => candidate !== sanity);
      unit.steps.push(sanity);
    },
  ]) {
    const unit = structuredClone(workflow.jobs.unit);
    mutate(unit);
    assert.throws(() => assertSanityGate(unit), { name: "AssertionError" });
  }
});

test("every test file belongs to an unconditional core suite or package E2E", async () => {
  const manifest = JSON.parse(await readFile(packageUrl, "utf8"));
  const suites = { unit: "test:unit", runtime: "test:unit", contract: "test:contract", integration: "test:integration", e2e: "test:e2e" };
  const root = new URL("../", import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const files = entries.filter((path) => /\.test\.(?:js|mjs)$/.test(path));
  assert.ok(files.length > 0);
  for (const file of files) {
    const directory = file.split(/[\\/]/)[0];
    assert.ok(Object.hasOwn(suites, directory), `Unassigned test: ${file}`);
    assert.ok(manifest.scripts[suites[directory]].includes(`test/${directory}/*.test.*`), file);
  }
});
