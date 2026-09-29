import { createCliRenderer } from "@opentui/core";
import {
  createRoot,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import { createElement } from "react";
import { Markdown } from "tui-md";

function MarkdownViewer({ content }) {
  const renderer = useRenderer();
  const { height, width } = useTerminalDimensions();

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") renderer.destroy();
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
      createElement("text", { fg: "#6b6b6b" }, "  [q/Esc] quit  [scroll] navigate"),
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

export async function renderTuiMarkdown(content, { stdin, stdout }) {
  let renderer;
  try {
    renderer = await createCliRenderer({
      clearOnShutdown: true,
      exitOnCtrlC: true,
      screenMode: "alternate-screen",
      stdin,
      stdout,
    });
    renderer.setTerminalTitle("Silvermoon");
    createRoot(renderer).render(createElement(MarkdownViewer, { content }));
  } catch (caught) {
    renderer?.destroy();
    throw caught;
  }
}
