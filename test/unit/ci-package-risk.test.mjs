import assert from "node:assert/strict";
import { test } from "node:test";
import { observePackageRisk, packageRisk, parseRiskArgs } from "../../scripts/ci-package-risk.mjs";

const idea = ".silvermoon/ideas/01M3R65W3C3F3HGQFW12H92SV0/ledger.md";
const base = "a".repeat(40);
const head = "b".repeat(40);

test("only known idea metadata can avoid package validation", () => {
  assert.equal(packageRisk([idea]).required, false);
  for (const path of [
    "src/cli.js", "schema/v1/config.schema.json", "assets/logo.svg",
    "README.md", "docs/maintaining.md", "package.json", "pnpm-lock.yaml",
    "package-lock.json", ".npmrc", "bin/silvermoon.js", "skills/silvermoon/SKILL.md",
    ".agents/skills/silvermoon/SKILL.md", "test/helpers/repository.js",
    "test/e2e/installed-package.test.js", "scripts/run-checks.mjs",
    ".github/workflows/ci.yml", "AGENTS.md", "unknown", "", null, undefined,
    ".silvermoon/ideas/unknown/ledger.md", idea.replace("/ledger.md", "/../src.js"),
    idea.replaceAll("/", "\\"), idea.replace("/ledger.md", "//file"),
  ]) {
    assert.equal(packageRisk([idea, path]).required, true, String(path));
  }
  assert.equal(packageRisk([]).required, true);
  assert.equal(packageRisk(null).required, true);
});

test("uses complete endpoint diff with NUL paths and both rename endpoints", () => {
  const calls = [];
  const result = observePackageRisk({
    base, head,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, stdout: `${idea}\0src/deleted.js\0` };
    },
  });
  assert.equal(result.required, true);
  assert.equal(calls[0].command, "git");
  assert.deepEqual(calls[0].args, ["diff", "--no-renames", "--name-only", "-z", base, head, "--"]);
  assert.equal(observePackageRisk({
    base, spawnImpl: () => ({ status: 0, stdout: `${idea}\0` }),
  }).required, false);
});

test("missing, failed, malformed and empty baselines escalate explicitly", () => {
  for (const options of [{}, { base: "" }, { base: "0".repeat(40) }, { base: "--bad" }, { base, head: "--bad" }, { full: true }]) {
    assert.equal(observePackageRisk({
      ...options, spawnImpl: () => assert.fail("must not spawn for untrusted revisions or --full"),
    }).required, true);
  }
  for (const result of [
    { error: new Error("git missing") }, { status: 128, stderr: "unknown revision" },
    { status: 0, stdout: "" }, { status: 0, stdout: idea },
  ]) {
    const risk = observePackageRisk({ base, spawnImpl: () => result });
    assert.equal(risk.required, true);
    assert.match(risk.reason, /running package checks/);
  }
  assert.match(observePackageRisk({
    base, spawnImpl: () => ({ error: new Error("git missing") }),
  }).reason, /git missing/);
});

test("risk options reject unknown, duplicate and incomplete arguments", () => {
  assert.deepEqual(parseRiskArgs(["--base", base, "--head", head, "--full"]), { base, head, full: true });
  assert.deepEqual(parseRiskArgs(["--base", ""]), { base: "" });
  for (const args of [["--typo"], ["--base"], ["--full", "--full"], ["--base", base, "--base", base], ["--head", "--full"]]) {
    assert.throws(() => parseRiskArgs(args), /Usage:/);
  }
});
