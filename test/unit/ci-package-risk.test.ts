import assert from "node:assert/strict";
import type { SpawnSyncReturns } from "node:child_process";
import { test } from "node:test";
import { observePackageRisk, packageRisk, parseRiskArgs } from "../../bin/ci-package-risk.ts";

const idea = ".silvermoon/ideas/01M3R65W3C3F3HGQFW12H92SV0/ledger.md";
const base = "a".repeat(40);
const head = "b".repeat(40);

function spawnResult({
  status = 0,
  stdout = "",
  stderr = "",
  error,
}: {
  status?: number | null;
  stdout?: string;
  stderr?: string;
  error?: Error;
} = {}): SpawnSyncReturns<string> {
  const result: SpawnSyncReturns<string> = {
    output: [null, stdout, stderr],
    pid: 1,
    signal: null,
    status,
    stderr,
    stdout,
  };
  return error === undefined ? result : { ...result, error };
}

test("only known idea metadata can avoid package validation", () => {
  assert.equal(packageRisk([idea]).required, false);
  for (const path of [
    "bin/silvermoon.ts", "schema/v1/config.schema.json", "assets/logo.svg",
    "README.md", "docs/maintaining.md", "package.json", "pnpm-lock.yaml",
    "package-lock.json", ".npmrc", "bin/silvermoon.ts", "skills/silvermoon/SKILL.md",
    ".agents/skills/silvermoon/SKILL.md", "test/helpers/repository.ts",
    "test/e2e/installed-package.test.ts", "bin/run-checks.ts",
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
  const calls: { command: string; args: readonly string[]; options: unknown }[] = [];
  const result = observePackageRisk({
    base, head,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      return spawnResult({ stdout: `${idea}\0src/deleted.js\0` });
    },
  });
  assert.equal(result.required, true);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.command, "git");
  assert.deepEqual(call.args, ["diff", "--no-renames", "--name-only", "-z", base, head, "--"]);
  assert.equal(observePackageRisk({
    base, spawnImpl: () => spawnResult({ stdout: `${idea}\0` }),
  }).required, false);
});

test("missing, failed, malformed and empty baselines escalate explicitly", () => {
  for (const options of [{}, { base: "" }, { base: "0".repeat(40) }, { base: "--bad" }, { base, head: "--bad" }, { full: true }]) {
    assert.equal(observePackageRisk({
      ...options,
      spawnImpl: () => {
        assert.fail("must not spawn for untrusted revisions or --full");
      },
    }).required, true);
  }
  for (const result of [
    spawnResult({ error: new Error("git missing"), status: null }),
    spawnResult({ status: 128, stderr: "unknown revision" }),
    spawnResult(),
    spawnResult({ stdout: idea }),
  ]) {
    const risk = observePackageRisk({ base, spawnImpl: () => result });
    assert.equal(risk.required, true);
    assert.match(risk.reason, /running package checks/);
  }
  assert.match(observePackageRisk({
    base,
    spawnImpl: () => spawnResult({ error: new Error("git missing"), status: null }),
  }).reason, /git missing/);
});

test("risk options reject unknown, duplicate and incomplete arguments", () => {
  assert.deepEqual(parseRiskArgs(["--base", base, "--head", head, "--full"]), { base, head, full: true });
  assert.deepEqual(parseRiskArgs(["--base", ""]), { base: "" });
  for (const args of [["--typo"], ["--base"], ["--full", "--full"], ["--base", base, "--base", base], ["--head", "--full"]]) {
    assert.throws(() => parseRiskArgs(args), /Usage:/);
  }
});
