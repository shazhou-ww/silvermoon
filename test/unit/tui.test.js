import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import {
  copyWindowsClipboard,
  copyStatusColor,
  copyTuiSelection,
  renderTuiMarkdown,
  tuiOutputStream,
} from "../../src/tui.js";

test("uses distinct readable colors for copy outcomes and restores the hint color", () => {
  assert.equal(copyStatusColor(null), "#6b6b6b");
  assert.equal(copyStatusColor({ kind: "success" }), "#9ccb9e");
  assert.equal(copyStatusColor({ kind: "warning" }), "#e2b86b");
  assert.throws(() => copyStatusColor({ kind: "unknown" }), /Unsupported copy status kind/);
});

test("copies the selected Unicode text and reports missing clipboard support", () => {
  const copied = [];
  const renderer = {
    getSelection: () => ({ getSelectedText: () => "中文 ┌─┐" }),
    copyToClipboardOSC52: (text) => {
      copied.push(text);
      return true;
    },
  };
  assert.deepEqual(copyTuiSelection(renderer), {
    message: "Copy sent to terminal clipboard",
    kind: "success",
  });
  assert.deepEqual(copied, ["中文 ┌─┐"]);

  renderer.getSelection = () => null;
  assert.deepEqual(
    copyTuiSelection(renderer),
    { message: "Select text first", kind: "warning" },
  );
  assert.deepEqual(copied, ["中文 ┌─┐"]);

  renderer.getSelection = () => ({ getSelectedText: () => "中文" });
  renderer.copyToClipboardOSC52 = () => false;
  assert.deepEqual(copyTuiSelection(renderer, { stdout: {} }), {
    message: "No clipboard; Shift+drag",
    kind: "warning",
  });
  const localCopies = [];
  assert.deepEqual(
    copyTuiSelection(renderer, {
      platform: "win32",
      windowsClipboard: (text) => {
        localCopies.push(text);
        return { ok: true };
      },
    }),
    { message: "Copied to Windows clipboard", kind: "success" },
  );
  assert.deepEqual(localCopies, ["中文"]);
  assert.deepEqual(
    copyTuiSelection(renderer, {
      platform: "win32",
      windowsClipboard: () => ({ ok: false, reason: "clipboard locked" }),
    }),
    { message: "Copy failed: clipboard locked", kind: "warning" },
  );
});

test("Windows clipboard subprocess receives exact UTF-8 bytes and reports failures", () => {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  assert.deepEqual(copyWindowsClipboard("中文 ┌─┐", spawn, "C:\\Windows"), { ok: true });
  assert.equal(
    calls[0].command,
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  );
  assert.deepEqual(calls[0].args.slice(0, 2), ["-NoProfile", "-NonInteractive"]);
  assert.match(calls[0].args[3], /Set-Clipboard -Value \$value/);
  assert.equal(calls[0].options.input.toString("utf8"), "中文 ┌─┐");
  assert.deepEqual(copyWindowsClipboard("中文", () => ({
    status: 1,
    stderr: "clipboard unavailable",
  }), "C:\\Windows"), { ok: false, reason: "clipboard unavailable" });
  assert.deepEqual(copyWindowsClipboard("中文", () => ({
    error: new Error("powershell missing"),
  }), "C:\\Windows"), { ok: false, reason: "powershell missing" });
  assert.deepEqual(copyWindowsClipboard("中文", spawn, ""), {
    ok: false,
    reason: "SystemRoot is unavailable",
  });
});

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
