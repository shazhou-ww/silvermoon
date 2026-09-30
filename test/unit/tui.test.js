import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import {
  copyWindowsClipboard,
  copyTuiSelection,
  renderTuiMarkdown,
  tuiOutputStream,
} from "../../src/tui.js";

test("copies the selected Unicode text and reports missing clipboard support", () => {
  const copied = [];
  const renderer = {
    getSelection: () => ({ getSelectedText: () => "中文 ┌─┐" }),
    copyToClipboardOSC52: (text) => {
      copied.push(text);
      return true;
    },
  };
  assert.equal(copyTuiSelection(renderer), "Copy sent to terminal clipboard");
  assert.deepEqual(copied, ["中文 ┌─┐"]);

  renderer.getSelection = () => null;
  assert.equal(
    copyTuiSelection(renderer),
    "Select text with the mouse before pressing y",
  );
  assert.deepEqual(copied, ["中文 ┌─┐"]);

  renderer.getSelection = () => ({ getSelectedText: () => "中文" });
  renderer.copyToClipboardOSC52 = () => false;
  assert.match(copyTuiSelection(renderer, { stdout: {} }), /Terminal clipboard unavailable/);
  const localCopies = [];
  assert.equal(
    copyTuiSelection(renderer, {
      platform: "win32",
      windowsClipboard: (text) => {
        localCopies.push(text);
        return { ok: true };
      },
    }),
    "Copied to Windows clipboard",
  );
  assert.deepEqual(localCopies, ["中文"]);
  assert.equal(
    copyTuiSelection(renderer, {
      platform: "win32",
      windowsClipboard: () => ({ ok: false, reason: "clipboard locked" }),
    }),
    "Copy failed: clipboard locked",
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
    stdin.write("y");
    for (let attempt = 0; !output().includes("clipboard") && attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output(), /Terminal clipboard unavailable/);
    assert.doesNotMatch(output(), /Select text with the mouse before pressing y/);
  } finally {
    stdin.write("q");
    stdin.destroy();
    stdout.destroy();
  }
});
