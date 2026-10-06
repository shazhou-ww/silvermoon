import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { inspectPureSources, loadJavaScriptSources, RULE_MODULES } from "../../bin/pure-check.ts";

const root = fileURLToPath(new URL("../../src", import.meta.url));
const parse = (path: string, source: string) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
const coordinate = (path: string) => relative(root, path).replaceAll("\\", "/");

function requiredSource(sources: ReadonlyMap<string, string>, path: string): string {
  const source = sources.get(path);
  if (source === undefined) assert.fail(`Missing source: ${coordinate(path)}`);
  return source;
}

async function sourceDirectories(path = root): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory())
    .map((entry) => sourceDirectories(resolve(path, entry.name))));
  return [path, ...nested.flat()];
}

function dependencies(path: string, source: string, { includeReExports = true } = {}) {
  const tree = parse(path, source);
  const dependencies: string[] = [];
  const visit = (node: ts.Node) => {
    let specifier;
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && node.moduleSpecifier) {
      specifier = node.moduleSpecifier;
    } else if (
      includeReExports
      && ts.isExportDeclaration(node)
      && !node.isTypeOnly
      && node.moduleSpecifier
    ) {
      specifier = node.moduleSpecifier;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = node.arguments[0];
    }
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
      dependencies.push(resolve(dirname(path), specifier.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return dependencies;
}

test("all declared pure functions and rule entrypoints satisfy path-aware boundaries", async () => {
  const result = inspectPureSources(await loadJavaScriptSources(root));
  assert.ok(result.count >= 144, `Expected existing pure coverage, received ${result.count}`);
  assert.equal(RULE_MODULES.length, 15);
  assert.deepEqual(result.problems, []);
});

test("every source directory has a concise responsibility README and explicit export-only index", async () => {
  const foundationRoot = resolve(root, "foundation");
  const foundationDirectories = (await readdir(foundationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(foundationRoot, entry.name));
  assert.equal(foundationDirectories.length, 30);
  const directories = [
    root,
    resolve(root, "business"),
    resolve(root, "business", "shared"),
    ...foundationDirectories,
  ];
  for (const directory of directories) {
    const [readme, source] = await Promise.all([
      readFile(resolve(directory, "README.md"), "utf8"),
      readFile(resolve(directory, "index.ts"), "utf8"),
    ]);
    assert.match(readme, /^# .+/);
    assert.ok(readme.trim().length >= 120, `${coordinate(directory)} must describe its responsibilities`);
    const lineLimit = directory === root ? 240 : 60;
    assert.ok(readme.split("\n").length <= lineLimit, `${coordinate(directory)} README must remain concise`);
    if (dirname(directory) === foundationRoot) {
      assert.match(readme, /## Capability boundary/);
      assert.match(readme, /## Key exports/);
    }
    const tree = parse(resolve(directory, "index.ts"), source);
    assert.ok(tree.statements.length > 0);
    assert.ok(tree.statements.every((node) => ts.isExportDeclaration(node)
      && node.exportClause && ts.isNamedExports(node.exportClause)),
    `${coordinate(directory)}/index.ts must only contain explicit named exports`);
  }
});

test("cross-directory imports use public indexes and siblings do not import their own facade", async () => {
  const sources = await loadJavaScriptSources(root);
  for (const [path, source] of sources) {
    for (const target of dependencies(path, source)) {
      assert.ok(sources.has(target), `${coordinate(path)} refers to missing source ${coordinate(target)}`);
      if (dirname(path) !== dirname(target)) {
        const sharedBusinessTypes = resolve(root, "business", "shared", "business-types.ts");
        assert.ok(
          target === resolve(dirname(target), "index.ts")
          || target === sharedBusinessTypes,
          `${coordinate(path)} accesses another module's private file ${coordinate(target)}`);
      } else if (path !== resolve(dirname(path), "index.ts")) {
        assert.notEqual(target, resolve(dirname(path), "index.ts"),
          `${coordinate(path)} must use concrete siblings, not its own facade`);
      }
    }
  }
});

test("shared business functions each own one implementation file", async () => {
  const shared = resolve(root, "business", "shared");
  const files = (await readdir(shared))
    .filter((name) =>
      name.endsWith(".ts")
      && name !== "index.ts"
      && name !== "business-types.ts");
  for (const name of files) {
    const path = resolve(shared, name);
    const tree = parse(path, await readFile(path, "utf8"));
    const exportedFunctions = tree.statements.filter((node) =>
      ts.isFunctionDeclaration(node)
      && node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword));
    assert.equal(exportedFunctions.length, 1,
      `${coordinate(path)} must export exactly one shared function`);
  }
});

test("business entries do not depend on bin, renderer, root API or another business entry", async () => {
  const sources = await loadJavaScriptSources(root);
  const entries = [
    "check-repository.ts", "list-ideas.ts", "whats-next.ts",
    "create-idea.ts", "event-command.ts", "migrate-v1-to-v2.ts",
  ].map((name) => resolve(root, "business", name));
  for (const path of entries) {
    for (const target of dependencies(path, requiredSource(sources, path))) {
      assert.notEqual(target, resolve(root, "index.ts"),
        "Business entries must not import the root package facade");
      assert.equal(coordinate(target).startsWith("foundation/renderer/"), false);
      assert.equal(entries.includes(target), false,
        `${coordinate(path)} depends on another business entry ${coordinate(target)}`);
    }
  }
});

test("the complete source dependency graph, including lazy imports, has no cycles", async () => {
  const sources = await loadJavaScriptSources(root);
  const graph = new Map([...sources].map(([path, source]) => [path, dependencies(path, source)]));
  const completed = new Set<string>();
  const active: string[] = [];
  const visit = (path: string) => {
    assert.equal(active.includes(path), false,
      `Dependency cycle: ${[...active, path].map(coordinate).join(" -> ")}`);
    if (completed.has(path)) return;
    active.push(path);
    const targets = graph.get(path);
    if (targets === undefined) assert.fail(`Missing dependency node: ${coordinate(path)}`);
    for (const target of targets) visit(target);
    active.pop();
    completed.add(path);
  };
  for (const path of graph.keys()) visit(path);
});

test("renderer facade does not eagerly load the TUI or Copilot SDK", async () => {
  const sources = await loadJavaScriptSources(root);
  const visited = new Set<string>();
  const inspect = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    const tree = parse(path, requiredSource(sources, path));
    for (const node of tree.statements) {
      if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
      assert.ok(ts.isStringLiteral(node.moduleSpecifier));
      const value = node.moduleSpecifier.text;
      assert.notEqual(value, "@github/copilot-sdk");
      if (value.startsWith(".")) {
        const target = resolve(dirname(path), value);
        assert.equal(coordinate(target).startsWith("foundation/tui/"), false);
        inspect(target);
      }
    }
  };
  inspect(resolve(root, "foundation", "renderer", "index.ts"));
});

test("authenticated projection source identity includes moved implementations and public rule facades", async () => {
  const sources = await loadJavaScriptSources(root);
  const path = resolve(root, "foundation", "projection-cache", "projection.ts");
  const tree = parse(path, requiredSource(sources, path));
  let coordinates: string[] | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node)) {
      const names = node.elements.filter(ts.isStringLiteral).map(({ text }) => text);
      if (names.includes("./projection.ts")) coordinates = names;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (coordinates === undefined) assert.fail("Projection coordinates are required");
  for (const name of [
    "../event-store/digest.ts", "../event-codec/index.ts",
    "../idea-model/index.ts", "../project-config/index.ts", "../git/index.ts",
  ]) assert.ok(coordinates.includes(name), name);
  for (const name of coordinates) assert.ok(sources.has(resolve(dirname(path), name)), name);
});

test("target architecture diagram declares three downward-only layers without claiming implementation", async () => {
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  assert.match(readme, /bin\/\s+# 应用层；每个可启动入口一个文件/);
  assert.match(readme, /business\/\s+# 业务层；每个业务入口函数一个文件/);
  assert.match(readme, /shared\/\s+# 每个共享业务函数一个文件/);
  assert.match(readme, /foundation\/\s+# 基础层；每个模块一个目录/);
  assert.match(readme, /逐项解释 `index\.ts` 输出的关键函数用途/);
  assert.match(readme, /观察严格分三层：device → project → idea/);
  assert.match(readme, /当前 `observeDevice` 只验证[\s\S]*daemon 模式形成独立契约后再扩展/);
  const diagram = /```mermaid\r?\n([\s\S]*?)\r?\n```/.exec(readme)?.[1];
  assert.ok(diagram, "Source README must contain the architecture diagram");
  const aliases = new Map();
  for (const match of diagram.matchAll(/^\s*(\w+)\["([^"]+)"\]\s*$/gm)) {
    const alias = match[1];
    const label = match[2];
    if (alias === undefined || label === undefined) {
      assert.fail("Architecture alias and label captures are required");
    }
    aliases.set(alias, label);
  }
  assert.deepEqual([...aliases.keys()].sort(), ["Application", "Business", "Foundation"]);
  assert.match(aliases.get("Application"), /^应用层/);
  assert.match(aliases.get("Business"), /^业务逻辑层/);
  assert.match(aliases.get("Foundation"), /^基础 I\/O 和工具层/);
  const drawn = new Set();
  for (const match of diagram.matchAll(/^\s*(\w+)\s*(-->|<-->)\s*(.+)$/gm)) {
    const sourceAlias = match[1];
    const direction = match[2];
    const targets = match[3];
    if (sourceAlias === undefined || direction === undefined || targets === undefined) {
      assert.fail("Architecture edge captures are required");
    }
    const from = aliases.get(sourceAlias);
    assert.ok(from, `Unknown diagram source ${sourceAlias}`);
    for (const target of targets.split(/\s*&\s*/)) {
      const to = aliases.get(target.trim());
      assert.ok(to, `Unknown diagram target ${target}`);
      assert.equal(direction, "-->", "Target layers must not have reverse dependencies");
      drawn.add(`${sourceAlias}->${target.trim()}`);
    }
  }
  assert.deepEqual([...drawn].sort(), [
    "Application->Business", "Application->Foundation", "Business->Foundation",
  ]);
  assert.ok(readme.includes("目标设计，不是当前源码依赖图"));
});
