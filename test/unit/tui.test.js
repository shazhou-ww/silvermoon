import assert from "node:assert/strict";
import { test } from "node:test";
import stringWidth from "string-width";

import { tuiMarkdownBlocks } from "../../src/tui-table.js";
import {
  copyWindowsClipboard,
  copyStatusColor,
  copyTuiSelection,
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

test("Unicode tables use terminal-cell widths without altering Markdown or narrow layouts", () => {
  const content = [
    "## 结果",
    "",
    "| Alias / ID | 状态 | 创建时间 | 标题 |",
    "| --- | --- | --- | --- |",
    "| a\\|b | implementing | 18小时前 | 中文标题 |",
    "",
    "### 下一步",
  ].join("\n");
  const blocks = tuiMarkdownBlocks(content, 120);
  assert.equal(blocks[0].content, "## 结果\n\n");
  assert.equal(blocks[1].kind, "table");
  assert.ok(blocks[1].lines.every((line) =>
    stringWidth(line) === blocks[1].width
  ));
  assert.match(blocks[1].lines[3], /a\|b.*18小时前.*中文标题/);
  assert.equal(blocks[2].content, "\n\n### 下一步");
  assert.deepEqual(
    tuiMarkdownBlocks(content, 35),
    [{ kind: "markdown", content }],
  );
});
