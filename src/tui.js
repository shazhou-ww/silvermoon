import { createCliRenderer } from "@opentui/core";
import { spawnSync } from "node:child_process";
import { win32 } from "node:path";
import {
  createRoot,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import { createElement, useState } from "react";
import { Markdown } from "tui-md";

export function copyWindowsClipboard(
  text,
  spawn = spawnSync,
  systemRoot = process.env.SystemRoot,
) {
  if (!systemRoot) return { ok: false, reason: "SystemRoot is unavailable" };
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)",
    "$value = [Console]::In.ReadToEnd()",
    "Set-Clipboard -Value $value",
  ].join("; ");
  const result = spawn(win32.join(
    systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
  ), [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ], {
    encoding: "utf8",
    input: Buffer.from(text, "utf8"),
    timeout: 5000,
    windowsHide: true,
  });
  if (result.error) return { ok: false, reason: result.error.message };
  if (result.status !== 0) {
    return {
      ok: false,
      reason: result.stderr?.trim().split(/\r?\n/, 1)[0]
        || `PowerShell exited with status ${result.status}`,
    };
  }
  return { ok: true };
}

export function copyTuiSelection(renderer, {
  stdout = process.stdout,
  platform = process.platform,
  windowsClipboard = copyWindowsClipboard,
} = {}) {
  const text = renderer.getSelection()?.getSelectedText();
  if (!text) return "Select text with the mouse before pressing y";
  if (renderer.copyToClipboardOSC52(text)) return "Copy sent to terminal clipboard";
  if (platform === "win32" && stdout === process.stdout) {
    const result = windowsClipboard(text);
    return result.ok ? "Copied to Windows clipboard" : `Copy failed: ${result.reason}`;
  }
  return "Terminal clipboard unavailable (try Shift+drag)";
}

function MarkdownViewer({ content, stdout }) {
  const renderer = useRenderer();
  const { height, width } = useTerminalDimensions();
  const [copyStatus, setCopyStatus] = useState("");

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") renderer.destroy();
    if (key.name === "y") setCopyStatus(copyTuiSelection(renderer, { stdout }));
  });

  return createElement(
    "box",
    {
      flexDirection: "column",
      height,
      width,
    },
    createElement(
      "box",
      {
        backgroundColor: "#1e1e1e",
        flexShrink: 0,
        paddingX: 1,
        width: "100%",
      },
      createElement("text", { fg: "#569cd6" }, "Silvermoon"),
      createElement(
        "text",
        { fg: "#6b6b6b" },
        "  [q/Esc] quit  [scroll] navigate  [drag, y] copy",
      ),
      copyStatus && createElement("text", { fg: "#6b6b6b" }, `  ${copyStatus}`),
    ),
    createElement(
      "scrollbox",
      {
        flexGrow: 1,
        flexShrink: 1,
        scrollY: true,
        width: "100%",
      },
      createElement(
        "box",
        {
          flexDirection: "column",
          paddingX: 2,
          paddingY: 1,
          width: Math.max(1, Math.min(width - 4, 100)),
        },
        createElement(Markdown, { content }),
      ),
    ),
  );
}

export function tuiOutputStream(stdout, platform = process.platform) {
  if (platform !== "win32") return stdout;

  // A distinct stream makes OpenTUI use its byte feed instead of writing UTF-8
  // directly through the native Windows console's legacy output code page.
  return {
    get columns() { return stdout.columns; },
    get rows() { return stdout.rows; },
    get isTTY() { return stdout.isTTY; },
    write: (...args) => stdout.write(...args),
    getColorDepth: (...args) => stdout.getColorDepth(...args),
  };
}

export async function renderTuiMarkdown(content, { stdin, stdout }) {
  let renderer;
  try {
    renderer = await createCliRenderer({
      clearOnShutdown: true,
      exitOnCtrlC: true,
      screenMode: "alternate-screen",
      stdin,
      stdout: tuiOutputStream(stdout),
    });
    renderer.setTerminalTitle("Silvermoon");
    createRoot(renderer).render(createElement(MarkdownViewer, { content, stdout }));
  } catch (caught) {
    renderer?.destroy();
    throw caught;
  }
}
