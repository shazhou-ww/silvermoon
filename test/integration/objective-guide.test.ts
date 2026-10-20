import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import {
  createProcessCheckProbe,
} from "../../src/objective-guide/index.ts";

for (const prefix of ["process-", "process with spaces-"]) {
  test(`process CheckProbe sends subject JSON and accepts the envelope protocol (${prefix})`, async () => {
    const cache = resolve(".cache", "silvermoon-objective-pilot-tests");
    await mkdir(cache, { recursive: true });
    const root = await mkdtemp(join(cache, prefix));
    try {
      assert.equal(dirname(root), cache);
      const entry = join(root, "check.mjs");
      await writeFile(entry, `
let source = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => source += chunk);
process.stdin.on("end", () => {
  const subject = JSON.parse(source);
  const payload = subject.ready
    ? { ok: true, problems: [] }
    : { ok: false, problems: [{ id: "not-ready", parameters: { received: subject } }] };
  process.stdout.write(JSON.stringify({ status: 200, payload, message: "" }));
});
`, "utf8");
      const probe = createProcessCheckProbe({
        command: process.execPath,
        args: [entry],
        cwd: root,
      });
      const failed = await probe({ ready: false }, new AbortController().signal);
      assert.deepEqual(failed, {
        status: 200,
        payload: {
          ok: false,
          problems: [{ id: "not-ready", parameters: { received: { ready: false } } }],
        },
        message: "",
      });
      const passed = await probe({ ready: true }, new AbortController().signal);
      assert.deepEqual(passed, {
        status: 200,
        payload: { ok: true, problems: [] },
        message: "",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
