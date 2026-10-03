import assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../../src/cli/cli.js";

function capture() {
  const logs = [];
  const errors = [];
  return {
    errors,
    io: {
      error: (value) => errors.push(value),
      log: (value) => logs.push(value),
    },
    logs,
  };
}

function terminal(stdinIsTTY = false, stdoutIsTTY = false) {
  return {
    stdin: { isTTY: stdinIsTTY },
    stdout: { isTTY: stdoutIsTTY },
  };
}

test("surfaces TUI initialization failures as command failures", async () => {
  const output = capture();
  const exitCode = await runCli(
    ["list-ideas", "--root", process.cwd()],
    output.io,
    {
      renderTui: async () => {
        throw new Error("fixture TUI failure");
      },
      terminal: terminal(true, true),
    },
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(output.logs, []);
  assert.deepEqual(output.errors, [
    "ERROR command.failed: fixture TUI failure",
  ]);
});
