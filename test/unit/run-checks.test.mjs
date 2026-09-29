import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isMain,
  packageManagerCommand,
  runChecks,
  runCheckScript,
} from "../../scripts/run-checks.mjs";

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
  const moduleUrl = new URL("../../scripts/run-checks.mjs", import.meta.url);
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

test("waits for all checks and reports every failure", async () => {
  let completed = false;
  await assert.rejects(
    runChecks({
      scripts: ["passes-late", "fails-one", "fails-two"],
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
