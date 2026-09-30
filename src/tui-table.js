import stringWidth from "string-width";
import { parse } from "tui-md";

function cellText(node) {
  if (node.type === "image") return node.alt ?? "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(cellText).join("");
}

function tableLines(node) {
  const rows = node.children.map((row) => row.children.map(cellText));
  const widths = rows[0].map((_, column) =>
    Math.max(3, ...rows.map((row) => stringWidth(row[column] ?? "") + 2))
  );
  const border = (left, middle, right) =>
    `${left}${widths.map((width) => "─".repeat(width)).join(middle)}${right}`;
  const rowLine = (row) =>
    `│${widths.map((width, column) => {
      const value = row[column] ?? "";
      const space = width - 2 - stringWidth(value);
      const alignment = node.align?.[column];
      const left = alignment === "right"
        ? space
        : alignment === "center" ? Math.floor(space / 2) : 0;
      return ` ${" ".repeat(left)}${value}${" ".repeat(space - left)} │`;
    }).join("")}`;
  const lines = [
    border("┌", "┬", "┐"),
    rowLine(rows[0]),
    border("├", "┼", "┤"),
  ];
  for (const [index, row] of rows.slice(1).entries()) {
    if (index > 0) lines.push(border("├", "┼", "┤"));
    lines.push(rowLine(row));
  }
  lines.push(border("└", "┴", "┘"));
  return { lines, width: stringWidth(lines[0]) };
}

export function tuiMarkdownBlocks(content, availableWidth) {
  if (!content.includes("|")) return [{ kind: "markdown", content }];
  const blocks = [];
  let offset = 0;
  for (const node of parse(content).children) {
    if (node.type !== "table") continue;
    if (!node.children.every((row) =>
      row.children.every((cell) =>
        cell.children.every((child) => child.type === "text")
      )
    )) continue;
    const table = tableLines(node);
    const hasWideText = node.children.some((row) =>
      row.children.some((cell) => {
        const text = cellText(cell);
        return stringWidth(text) > text.length;
      })
    );
    if (!hasWideText || table.width > availableWidth) continue;
    const start = node.position.start.offset;
    const end = node.position.end.offset;
    if (start > offset) {
      blocks.push({ kind: "markdown", content: content.slice(offset, start) });
    }
    blocks.push({ kind: "table", lines: table.lines, width: table.width });
    offset = end;
  }
  if (offset < content.length) {
    blocks.push({ kind: "markdown", content: content.slice(offset) });
  }
  return blocks.length === 0 ? [{ kind: "markdown", content }] : blocks;
}
