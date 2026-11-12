import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { regularBytes, stateTransaction } from "../../src/foundation/state-transaction/index.ts";

const statePath = ".silvermoon/config.yaml";

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-transaction-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".silvermoon"));
  await writeFile(join(root, statePath), "before\n");
  return root;
}

test("failed validation releases an unwritten transaction and permits a fresh retry", async (t) => {
  const root = await fixture(t);
  const files = [{ path: statePath, before: "before\n", after: "after\n" }];
  await assert.rejects(stateTransaction(root, "events", files, {
    validate() { throw new Error("Primary moved before write"); },
  }), /aborted before application.*Primary moved before write/);
  assert.equal(await readFile(join(root, statePath), "utf8"), "before\n");
  assert.equal(await regularBytes(join(root, ".silvermoon/transaction")), null);
  await stateTransaction(root, "events", files);
  assert.equal(await readFile(join(root, statePath), "utf8"), "after\n");
});

test("validation cleanup preserves externally changed state and its transaction", async (t) => {
  const root = await fixture(t);
  await assert.rejects(stateTransaction(root, "events", [
    { path: statePath, before: "before\n", after: "after\n" },
  ], {
    async validate() {
      await writeFile(join(root, statePath), "external\n");
      throw new Error("Source changed");
    },
  }), /cleanup is unconfirmed/);
  assert.equal(await readFile(join(root, statePath), "utf8"), "external\n");
  assert.notEqual(await regularBytes(join(root, ".silvermoon/transaction")), null);
});

test("validation cleanup preserves unknown pending bytes", async (t) => {
  const root = await fixture(t);
  await assert.rejects(stateTransaction(root, "events", [
    { path: statePath, before: "before\n", after: "after\n" },
  ], {
    async validate() {
      await writeFile(join(root, `${statePath}.pending`), "external\n");
      throw new Error("Validation failed");
    },
  }), /cleanup is unconfirmed/);
  assert.equal(await readFile(join(root, `${statePath}.pending`), "utf8"), "external\n");
  assert.notEqual(await regularBytes(join(root, ".silvermoon/transaction")), null);
});

test("validation cleanup preserves a replaced transaction plan", async (t) => {
  const root = await fixture(t);
  const replacement = "replacement transaction evidence\n";
  await assert.rejects(stateTransaction(root, "events", [
    { path: statePath, before: "before\n", after: "after\n" },
  ], {
    async validate() {
      await writeFile(join(root, ".silvermoon/transaction"), replacement);
      throw new Error("Validation failed");
    },
  }), /cleanup is unconfirmed.*Transaction plan changed/);
  assert.equal(await readFile(join(root, statePath), "utf8"), "before\n");
  assert.equal(await readFile(join(root, ".silvermoon/transaction"), "utf8"), replacement);
});

test("failure after application preserves the recovery plan", async (t) => {
  const root = await fixture(t);
  await assert.rejects(stateTransaction(root, "events", [
    { path: statePath, before: "before\n", after: "after\n" },
  ], {
    validateApplied() { throw new Error("Post-write validation failed"); },
  }), /State transaction incomplete/);
  assert.equal(await readFile(join(root, statePath), "utf8"), "after\n");
  assert.notEqual(await regularBytes(join(root, ".silvermoon/transaction")), null);
});
