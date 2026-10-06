import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runSubprocess } from "../../src/foundation/process/index.ts";
import { withTraceFile } from "../../src/foundation/trace/index.ts";

test("traces subprocess outcomes without persisting arguments or input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "silvermoon-subprocess-"));
  const path = join(directory, "subprocess.trace.jsonl");
  const canary = "secret-subprocess-canary";
  const spawn = new Proxy(spawnSync, {
    apply(_target, _thisArgument, argumentList) {
      const [command, args, options] = argumentList;
      assert.equal(command, "fixture-command");
      assert.deepEqual(args, [canary]);
      assert.ok(options !== null && typeof options === "object");
      assert.equal(Reflect.get(options, "input"), canary);
      return { signal: null, status: 0 };
    },
  });
  try {
    await withTraceFile(path, "command.test", {}, () =>
      runSubprocess(
        "fixture-command",
        [canary],
        { encoding: "utf8", input: canary },
        {
          attributes: { operation: "fixture" },
          spawn,
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
