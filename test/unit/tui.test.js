import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import { renderTuiMarkdown, tuiOutputStream } from "../../src/tui.js";

test("Windows TUI output delegates UTF-8 frames to the Node terminal stream", () => {
  const chunks = [];
  const stdout = {
    columns: 90,
    rows: 25,
    isTTY: true,
    getColorDepth: () => 8,
    write(chunk, callback) {
      chunks.push(chunk);
      callback?.();
      return true;
    },
  };
  const windows = tuiOutputStream(stdout, "win32");
  assert.notEqual(windows, stdout);
  assert.equal(windows.columns, 90);
  assert.equal(windows.rows, 25);
  assert.equal(windows.isTTY, true);
  assert.equal(windows.getColorDepth(), 8);
  stdout.columns = 110;
  assert.equal(windows.columns, 110);

  const content = "选择要继续的工作 ┌─┬─┐";
  windows.write(Buffer.from(content, "utf8"));
  assert.equal(Buffer.concat(chunks).toString("utf8"), content);
  assert.equal(tuiOutputStream(stdout, "linux"), stdout);
  assert.equal(tuiOutputStream(stdout, "darwin"), stdout);
});

test("Windows native TUI feed preserves Chinese and box-drawing characters", {
  skip: process.platform !== "win32",
  timeout: 10_000,
}, async () => {
  const chunks = [];
  const stdin = new PassThrough();
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  stdout.isTTY = true;
  stdout.columns = 90;
  stdout.rows = 25;
  stdout.getColorDepth = () => 8;

  try {
    await renderTuiMarkdown(
      "## 选择要继续的工作\n\n| 名称 | 状态 |\n| --- | --- |\n| 中文 | 活跃 |\n",
      { stdin, stdout },
    );
    let output = "";
    for (let attempt = 0; attempt < 80; attempt += 1) {
      output = Buffer.concat(chunks).toString("utf8");
      if (output.includes("选择要继续的工作")
        && output.includes("中")
        && output.includes("文")
        && output.includes("┌")) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output, /选择要继续的工作/);
    assert.match(output, /中/);
    assert.match(output, /文/);
    assert.match(output, /┌/);
    assert.doesNotMatch(output, /\uFFFD/);
  } finally {
    stdin.write("q");
    stdin.destroy();
    stdout.destroy();
  }
});
