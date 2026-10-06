import assert from "node:assert/strict";
import type { SpawnSyncReturns } from "node:child_process";
import { test } from "node:test";
import stringWidth from "string-width";

import { tuiMarkdownBlocks } from "../../src/foundation/tui/index.ts";
import {
  copyWindowsClipboard,
  copyStatusColor,
  copyTuiSelection,
  tuiOutputStream,
} from "../../src/foundation/tui/index.ts";

function spawnResult({
  status = 0,
  stderr = "",
  error,
}: {
  status?: number | null;
  stderr?: string;
  error?: Error;
} = {}): SpawnSyncReturns<string> {
  const result: SpawnSyncReturns<string> = {
    output: [null, "", stderr],
    pid: 1,
    signal: null,
    status,
    stderr,
    stdout: "",
  };
  return error === undefined ? result : { ...result, error };
}

test("uses distinct readable colors for copy outcomes and restores the hint color", () => {
  assert.equal(copyStatusColor(null), "#6b6b6b");
  assert.equal(copyStatusColor({ kind: "success" }), "#9ccb9e");
  assert.equal(copyStatusColor({ kind: "warning" }), "#e2b86b");
  assert.throws(() => copyStatusColor({ kind: "unknown" }), /Unsupported copy status kind/);
});

test("copies the selected Unicode text and reports missing clipboard support", () => {
  const copied: string[] = [];
  const renderer: Parameters<typeof copyTuiSelection>[0] = {
    getSelection: () => ({ getSelectedText: () => "中文 ┌─┐" }),
    copyToClipboardOSC52: (text: string) => {
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
  const localCopies: string[] = [];
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
  const calls: Array<{
    command: string;
    args: readonly string[];
    options: Parameters<NonNullable<Parameters<typeof copyWindowsClipboard>[1]>>[2];
  }> = [];
  const spawn: Parameters<typeof copyWindowsClipboard>[1] = (command, args, options) => {
    calls.push({ command, args, options });
    return spawnResult();
  };
  assert.deepEqual(copyWindowsClipboard("中文 ┌─┐", spawn, "C:\\Windows"), { ok: true });
  const call = calls[0];
  assert.ok(call);
  assert.equal(
    call.command,
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  );
  assert.deepEqual(call.args.slice(0, 2), ["-NoProfile", "-NonInteractive"]);
  const script = call.args[3];
  assert.ok(script);
  assert.match(script, /Set-Clipboard -Value \$value/);
  const input = call.options.input;
  assert.ok(Buffer.isBuffer(input));
  assert.equal(input.toString("utf8"), "中文 ┌─┐");
  assert.deepEqual(copyWindowsClipboard("中文", () =>
    spawnResult({ status: 1, stderr: "clipboard unavailable" }), "C:\\Windows"),
  { ok: false, reason: "clipboard unavailable" });
  assert.deepEqual(copyWindowsClipboard("中文", () =>
    spawnResult({ error: new Error("powershell missing"), status: null }), "C:\\Windows"),
  { ok: false, reason: "powershell missing" });
  assert.deepEqual(copyWindowsClipboard("中文", spawn, ""), {
    ok: false,
    reason: "SystemRoot is unavailable",
  });
});

test("Windows TUI output delegates UTF-8 frames to the Node terminal stream", () => {
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  const dimensions = { columns: 90, rows: 25 };
  const stdout = new Proxy(process.stdout, {
    get(target, property, receiver) {
      if (property === "columns") return dimensions.columns;
      if (property === "rows") return dimensions.rows;
      if (property === "isTTY") return true;
      if (property === "getColorDepth") return () => 8;
      if (property === "write") {
        return (chunk: Uint8Array<ArrayBufferLike>, callback?: () => void) => {
          chunks.push(chunk);
          callback?.();
          return true;
        };
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property === "columns" && typeof value === "number") {
        dimensions.columns = value;
        return true;
      }
      if (property === "rows" && typeof value === "number") {
        dimensions.rows = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
  });
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
  const heading = blocks[0];
  const table = blocks[1];
  const trailing = blocks[2];
  assert.ok(heading && heading.kind === "markdown");
  assert.ok(table && table.kind === "table");
  assert.ok(trailing && trailing.kind === "markdown");
  assert.equal(heading.content, "## 结果\n\n");
  assert.equal(table.kind, "table");
  assert.ok(table.lines.every((line) =>
    stringWidth(line) === table.width
  ));
  const dataLine = table.lines[3];
  assert.ok(dataLine);
  assert.match(dataLine, /a\|b.*18小时前.*中文标题/);
  assert.equal(trailing.content, "\n\n### 下一步");
  assert.deepEqual(
    tuiMarkdownBlocks(content, 35),
    [{ kind: "markdown", content }],
  );
});
