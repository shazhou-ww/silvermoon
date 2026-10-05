import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CHECK_SCRIPTS,
  CHECK_TIERS,
  COMMIT_SCOPE,
  isMain,
  packageManagerCommand,
  runChecks,
  runCheckScript,
  selectChecks,
} from "../../bin/run-checks.mjs";

test("selects exact scenario sets without changing release compatibility", async () => {
  assert.equal(selectChecks([]), CHECK_SCRIPTS);
  assert.equal(selectChecks(["--tier", "release"]), CHECK_SCRIPTS);
  assert.deepEqual(selectChecks(["--tier", "sanity"]), ["check:syntax", "check:pure", "test:sanity"]);
  assert.ok(CHECK_SCRIPTS.includes("check:pure"));
  assert.deepEqual(selectChecks(["--tier", "commit"]), [
    "check:sanity", "test:contract", "lint:markdown", "check:skills:local",
    "test:smoke", "check:staged", "check:diff",
  ]);
  assert.equal(CHECK_TIERS.release, CHECK_SCRIPTS);
  assert.match(COMMIT_SCOPE, /WORKTREE, not staged code/);
  assert.match(COMMIT_SCOPE, /Partial staging is NOT exact-candidate test evidence/);
  for (const args of [["--full"], ["--tier"], ["--tier", "typo"], ["--tier", "sanity", "extra"], ["--tier", "toString"]]) {
    assert.throws(() => selectChecks(args), /Usage:/);
  }
  for (const scripts of [[], null, [""], [undefined]]) {
    await assert.rejects(runChecks({ scripts }), /non-empty list/);
  }
});

test("uses the invoking package manager when available", () => {
  assert.deepEqual(
    packageManagerCommand("test", {
      env: { npm_execpath: "/tools/pnpm.cjs" },
      execPath: "/tools/node",
      platform: "linux",
    }),
    {
      command: "/tools/node",
      args: ["/tools/pnpm.cjs", "run", "test"],
    },
  );
  assert.deepEqual(
    packageManagerCommand("test", {
      env: { npm_execpath: "C:\\tools\\pnpm.exe" },
      execPath: "C:\\tools\\node.exe",
      platform: "win32",
    }),
    {
      command: "C:\\tools\\pnpm.exe",
      args: ["run", "test"],
    },
  );
});

test("falls back to a platform-safe npm command", () => {
  assert.deepEqual(
    packageManagerCommand("test", {
      env: {},
      execPath: "node",
      platform: "linux",
    }),
    { command: "npm", args: ["run", "test"] },
  );
  assert.deepEqual(
    packageManagerCommand("test", {
      env: { ComSpec: "cmd.exe" },
      execPath: "node.exe",
      platform: "win32",
    }),
    {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm run test"],
    },
  );
});

test("recognizes the executable module path on the current platform", () => {
  const moduleUrl = new URL("../../bin/run-checks.mjs", import.meta.url);
  assert.equal(
    isMain(moduleUrl.href, ["node", fileURLToPath(moduleUrl)]),
    true,
  );
});

test("runs every check concurrently", async () => {
  const pending = new Map();
  const started = [];
  const execution = runChecks({
    scripts: ["first", "second", "third"],
    writeOutput() {},
    runScript(script) {
      started.push(script);
      return new Promise((resolve) => pending.set(script, resolve));
    },
  });

  await Promise.resolve();
  assert.deepEqual(started, ["first", "second", "third"]);
  for (const resolve of pending.values()) resolve();
  await execution;
});

test("reports monotonic per-check and total durations", async () => {
  const output = [];
  let tick = 0;

  await runChecks({
    scripts: ["first", "second"],
    now: () => tick++ * 10,
    writeOutput: (message) => output.push(message),
    runScript: async () => {},
  });

  assert.deepEqual(output, [
    "CHECK_DURATION first 20ms\n",
    "CHECK_DURATION second 20ms\n",
    "CHECK_TOTAL 50ms\n",
  ]);
});

test("waits for all checks and reports every failure", async () => {
  let completed = false;
  const output = [];
  await assert.rejects(
    runChecks({
      scripts: ["passes-late", "fails-one", "fails-two"],
      writeOutput: (message) => output.push(message),
      runScript(script) {
        if (script === "passes-late") {
          return new Promise((resolve) =>
            setImmediate(() => {
              completed = true;
              resolve();
            }),
          );
        }
        return Promise.reject(new Error(`${script} detail`));
      },
    }),
    (error) => {
      assert.equal(completed, true);
      assert.match(error.message, /fails-one detail/);
      assert.match(error.message, /fails-two detail/);
      return true;
    },
  );
  assert.equal(output.filter((message) => message.startsWith("CHECK_DURATION")).length, 3);
  assert.equal(output.filter((message) => message.startsWith("CHECK_TOTAL")).length, 1);
});

test("surfaces process startup and nonzero exit failures", async () => {
  const spawnError = new EventEmitter();
  const cannotStart = runCheckScript("broken", {
    spawnImpl() {
      return spawnError;
    },
  });
  spawnError.emit("error", new Error("missing executable"));
  await assert.rejects(cannotStart, /broken could not start: missing executable/);

  const failedChild = new EventEmitter();
  const nonzero = runCheckScript("broken", {
    spawnImpl() {
      return failedChild;
    },
  });
  failedChild.emit("close", 7, null);
  await assert.rejects(nonzero, /broken failed with exit code 7/);
});
