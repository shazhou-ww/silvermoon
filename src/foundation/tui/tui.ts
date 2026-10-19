import { createCliRenderer } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";
import { win32 } from "node:path";
import {
  createRoot,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "tui-md";

import { runSubprocess } from "../process/index.ts";
import { tuiMarkdownBlocks } from "./table.ts";
import type {
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from "node:child_process";

const COPY_STATUS_DURATION_MS = 3000;
const SHORTCUT_HINT = "  [q/Esc] quit  [scroll] navigate  [drag, y] copy";
const SUCCESS_COLOR = "#9ccb9e";
const WARNING_COLOR = "#e2b86b";

function spawnClipboard(command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding) {
  return runSubprocess(command, args, options, {
    attributes: { operation: "windows-clipboard" },
  });
}

export function copyStatusColor(status: { kind: unknown; }|null) {
  if (status === null) return "#6b6b6b";
  if (status.kind === "success") return SUCCESS_COLOR;
  if (status.kind === "warning") return WARNING_COLOR;
  throw new Error(`Unsupported copy status kind: ${status.kind}`);
}

export function copyWindowsClipboard(
  text: string,
  spawn: (
    command: string,
    args: readonly string[],
    options: SpawnSyncOptionsWithStringEncoding,
  ) => SpawnSyncReturns<string> = spawnClipboard,
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

interface SelectionRenderer {
  getSelection(): { getSelectedText(): string } | null;
  copyToClipboardOSC52(text: string): boolean;
}

interface CopyStatus {
  kind: "success" | "warning";
  message: string;
}

export function copyTuiSelection(renderer: SelectionRenderer, {
  stdout = process.stdout,
  platform = process.platform,
  windowsClipboard = copyWindowsClipboard,
}: {
  stdout?: NodeJS.WriteStream | object;
  platform?: NodeJS.Platform;
  windowsClipboard?: typeof copyWindowsClipboard;
} = {}): CopyStatus {
  const text = renderer.getSelection()?.getSelectedText();
  if (!text) return { message: "Select text first", kind: "warning" };
  if (renderer.copyToClipboardOSC52(text)) {
    return { message: "Copy sent to terminal clipboard", kind: "success" };
  }
  if (platform === "win32" && stdout === process.stdout) {
    const result = windowsClipboard(text);
    return result.ok
      ? { message: "Copied to Windows clipboard", kind: "success" }
      : { message: `Copy failed: ${result.reason}`, kind: "warning" };
  }
  return { message: "No clipboard; Shift+drag", kind: "warning" };
}

function MarkdownViewer({
  content,
  stdout,
}: { content: string; stdout: NodeJS.WriteStream }) {
  const renderer = useRenderer();
  const { height, width } = useTerminalDimensions();
  const [copyStatus, setCopyStatus] = useState<CopyStatus | null>(null);
  const copyStatusTimeout = useRef<NodeJS.Timeout | null>(null);
  const contentWidth = Math.max(1, width - 4);
  const blocks = useMemo(
    () => tuiMarkdownBlocks(content, contentWidth),
    [content, contentWidth],
  );

  useEffect(() => () => {
    if (copyStatusTimeout.current !== null) clearTimeout(copyStatusTimeout.current);
  }, []);

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") renderer.destroy();
    if (key.name === "y") {
      if (copyStatusTimeout.current !== null) clearTimeout(copyStatusTimeout.current);
      setCopyStatus(copyTuiSelection(renderer, { stdout }));
      copyStatusTimeout.current = setTimeout(() => {
        setCopyStatus(null);
        copyStatusTimeout.current = null;
      }, COPY_STATUS_DURATION_MS);
    }
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
        {
          fg: copyStatusColor(copyStatus),
          height: 1,
          truncate: true,
          width: "100%",
          wrapMode: "none",
        },
        copyStatus ? `  ${copyStatus.message}` : SHORTCUT_HINT,
      ),
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
          width: contentWidth,
        },
        ...blocks.map((block, index) =>
          block.kind === "markdown"
            ? createElement(Markdown, { key: index, content: block.content })
            : createElement(
              "box",
              { key: index, flexDirection: "column", marginBottom: 1, width: "100%" },
              ...block.lines.map((line, lineIndex) =>
                createElement("text", {
                  key: lineIndex,
                  fg: lineIndex === 1 ? "#569cd6" : "#d4d4d4",
                  width: block.width,
                  wrapMode: "none",
                }, line)
              ),
            )
        ),
      ),
    ),
  );
}

export function tuiOutputStream(stdout: NodeJS.WriteStream, platform = process.platform) {
  if (platform !== "win32") return stdout;

  // A distinct stream makes OpenTUI use its byte feed instead of writing UTF-8
  // directly through the native Windows console's legacy output code page.
  return new Proxy(stdout, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export async function renderTuiMarkdown(
  content: string,
  { stdin, stdout }: { stdin: NodeJS.ReadStream; stdout: NodeJS.WriteStream },
) {
  let renderer: CliRenderer | undefined;
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
