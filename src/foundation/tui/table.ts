import stringWidth from "string-width";
import { parse } from "tui-md";

interface MarkdownNode {
  type: string;
  alt?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

interface TableNode {
  type: "table";
  align?: (string | null)[];
  children: { children: { children: MarkdownNode[] }[] }[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export type TuiMarkdownBlock =
  | { kind: "markdown"; content: string }
  | { kind: "table"; lines: string[]; width: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMarkdownNode(value: unknown): value is MarkdownNode {
  return isRecord(value)
    && typeof value.type === "string"
    && (value.children === undefined
      || (Array.isArray(value.children) && value.children.every(isMarkdownNode)));
}

function isTableNode(value: unknown): value is TableNode {
  return isMarkdownNode(value)
    && value.type === "table"
    && Array.isArray(value.children)
    && value.children.every((row) =>
      isRecord(row)
      && Array.isArray(row.children)
      && row.children.every((cell) =>
        isRecord(cell)
        && Array.isArray(cell.children)
        && cell.children.every(isMarkdownNode)
      )
    );
}

function cellText(node: MarkdownNode): string {
  if (node.type === "image") return node.alt ?? "";
  if (typeof node.value === "string") return node.value;
  return node.children?.map(cellText).join("") ?? "";
}

function terminalCellText(node: MarkdownNode): string {
  return cellText(node).replaceAll("\t", "    ");
}

function tableLines(node: TableNode) {
  const rows = node.children.map((row) => row.children.map((cell) =>
    cell.children.map(terminalCellText).join("")
  ));
  const firstRow = rows[0] ?? [];
  const widths = firstRow.map((_, column) =>
    Math.max(3, ...rows.map((row) => stringWidth(row[column] ?? "") + 2))
  );
  const border = (left: string, middle: string, right: string) =>
    `${left}${widths.map((width: number) => "─".repeat(width)).join(middle)}${right}`;
  const rowLine = (row: string[]) =>
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
    rowLine(firstRow),
    border("├", "┼", "┤"),
  ];
  for (const [index, row] of rows.slice(1).entries()) {
    if (index > 0) lines.push(border("├", "┼", "┤"));
    lines.push(rowLine(row));
  }
  lines.push(border("└", "┴", "┘"));
  return { lines, width: stringWidth(lines[0] ?? "") };
}

export function tuiMarkdownBlocks(
  content: string,
  availableWidth: number,
): TuiMarkdownBlock[] {
  if (!content.includes("|")) return [{ kind: "markdown", content }];
  const blocks: TuiMarkdownBlock[] = [];
  let offset = 0;
  for (const node of parse(content).children) {
    if (!isTableNode(node)) continue;
    if (!node.children.every((row) =>
      row.children.every((cell) =>
        cell.children.every((child) => child.type === "text")
      )
    )) continue;
    const table = tableLines(node);
    const hasWideText = node.children.some((row) =>
      row.children.some((cell) => {
        const text = cell.children.map(terminalCellText).join("");
        return stringWidth(text) > text.length;
      })
    );
    if (!hasWideText || table.width > availableWidth) continue;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) continue;
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
