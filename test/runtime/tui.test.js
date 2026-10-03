import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import { renderTuiMarkdown } from "../../src/presentation/tui/tui.js";

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

test("wide TUI shows table columns beyond the first 100 cells", {
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
  stdout.columns = 160;
  stdout.rows = 25;
  stdout.getColorDepth = () => 8;

  const content = [
    "X".repeat(120),
    "",
    "| Alias / ID | State | Created | Title |",
    "| --- | --- | --- | --- |",
    `| ${"a".repeat(35)} | implementing | 18小时前 | ${"Title ".repeat(11)}END-OF-TITLE |`,
  ].join("\n");
  const output = () => Buffer.concat(chunks).toString("utf8");
  try {
    await renderTuiMarkdown(content, { stdin, stdout });
    for (let attempt = 0; !output().includes("END-OF-TITLE") && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output(), /X{110}/);
    assert.match(output(), /┌[─┬]{110,}┐/);
    assert.match(output(), /END-OF-TITLE/);
    assert.match(output(), /18小时前/);
  } finally {
    stdin.write("q");
    stdin.destroy();
    stdout.destroy();
  }
});

test("Windows TUI mouse selection and y shortcut report clipboard outcome", {
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

  const output = () => Buffer.concat(chunks).toString("utf8");
  try {
    await renderTuiMarkdown("## 选择要继续的工作", { stdin, stdout });
    for (let attempt = 0; !output().includes("选择要继续的工作") && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output(), /选择要继续的工作/);

    stdin.write("\x1B[<0;7;4M\x1B[<32;19;4M\x1B[<0;19;4m");
    const beforeCopy = Buffer.concat(chunks).length;
    stdin.write("y");
    for (let attempt = 0; !output().includes("No clipboard;") && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output(), /No clipboard;/);
    assert.match(output(), /Shift\+drag/);
    assert.doesNotMatch(output(), /Select text first/);
    const statusFrame = Buffer.concat(chunks).subarray(beforeCopy).toString("utf8");
    assert.match(statusFrame, /\x1B\[2;2H/);
    assert.match(statusFrame, /No clipboard;/);
    assert.match(statusFrame, /Shift\+drag/);
    assert.match(statusFrame, /\x1B\[38;2;226;184;107m/);
    assert.doesNotMatch(statusFrame, /\x1B\[5;6H[^\x1B]*选择/);

    const afterFirstCopy = Buffer.concat(chunks).length;
    await new Promise((resolve) => setTimeout(resolve, 1600));
    stdin.write("y");
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const beforeExpiry = Buffer.concat(chunks).subarray(afterFirstCopy).toString("utf8");
    assert.doesNotMatch(beforeExpiry, /\[q\/Esc\] quit/);

    for (let attempt = 0; !Buffer.concat(chunks).subarray(afterFirstCopy)
      .toString("utf8").includes("[q/Esc] quit") && attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const restored = Buffer.concat(chunks).subarray(afterFirstCopy).toString("utf8");
    assert.match(restored, /\[q\/Esc\] quit/);
    assert.match(restored, /\x1B\[38;2;107;107;107m/);
    assert.doesNotMatch(restored, /\x1B\[5;6H[^\x1B]*选择/);
  } finally {
    stdin.write("q");
    stdin.destroy();
    stdout.destroy();
  }
});

test("narrow Windows TUI truncates copy feedback without moving the document", {
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
  stdout.columns = 35;
  stdout.rows = 20;
  stdout.getColorDepth = () => 8;

  const output = () => Buffer.concat(chunks).toString("utf8");
  try {
    await renderTuiMarkdown("## 选择要继续的工作", { stdin, stdout });
    for (let attempt = 0; !output().includes("选择要继续的工作") && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output(), /\x1B\[4;6H/);

    const beforeCopy = Buffer.concat(chunks).length;
    stdin.write("y");
    for (let attempt = 0; !output().includes("Select text first")
      && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const statusFrame = Buffer.concat(chunks).subarray(beforeCopy).toString("utf8");
    assert.match(statusFrame, /Select text first/);
    assert.doesNotMatch(statusFrame, /\x1B\[5;6H[^\x1B]*选择/);
  } finally {
    stdin.write("q");
    stdin.destroy();
    stdout.destroy();
  }
});
