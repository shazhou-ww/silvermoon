import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runSubprocess } from "../../src/foundation/process/index.js";
import { withTraceFile } from "../../src/foundation/trace/index.js";

test("traces subprocess outcomes without persisting arguments or input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silvermoon-subprocess-"));
  const path = join(directory, "subprocess.trace.jsonl");
  const canary = "secret-subprocess-canary";
  try {
    await withTraceFile(path, "command.test", {}, () =>
      runSubprocess(
        "fixture-command",
        [canary],
        { input: canary },
        {
          attributes: { operation: "fixture" },
          spawn: (command, args, options) => {
            assert.equal(command, "fixture-command");
            assert.deepEqual(args, [canary]);
            assert.equal(options.input, canary);
            return { signal: null, status: 0 };
          },
        },
      ));

    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, new RegExp(canary));
    const events = source.trim().split("\n").map((line) => JSON.parse(line));
    const start = events.find(
      ({ event, name }) =>
        event === "span-start" && name === "process.command",
    );
    const end = events.find(
      ({ event, name }) =>
        event === "span-end" && name === "process.command",
    );
    assert.deepEqual(start.attributes, { operation: "fixture" });
    assert.deepEqual(end.attributes, {
      operation: "fixture",
      exitCode: 0,
      signal: null,
    });
    assert.equal(end.status, "ok");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
