import assert from "node:assert/strict";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { fromMarkdown } from "mdast-util-from-markdown";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "ideas", "node_modules"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

interface MarkdownNode {
  type: string;
  url?: string;
  children?: MarkdownNode[];
}

function links(node: MarkdownNode, result: string[] = []): string[] {
  if (node.type === "link" && node.url !== undefined) result.push(node.url);
  for (const child of node.children ?? []) links(child, result);
  return result;
}

test("keeps repository-local Markdown links resolvable", async () => {
  for (const path of await markdownFiles(repositoryRoot)) {
    const source = await readFile(path, "utf8");
    for (const url of links(fromMarkdown(source))) {
      if (/^(?:[a-z]+:|#)/i.test(url)) continue;
      const targetPath = url.split(/[?#]/, 1)[0];
      if (targetPath === undefined) assert.fail(`Link has no path: ${url}`);
      const target = decodeURIComponent(targetPath);
      const absolute = target.startsWith("/")
        ? resolve(repositoryRoot, target.slice(1))
        : resolve(dirname(path), target);
      await assert.doesNotReject(
        lstat(absolute),
        `${path} links to missing repository path ${url}`,
      );
    }
  }
});