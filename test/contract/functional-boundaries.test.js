import assert from "node:assert/strict";
import { test } from "node:test";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { inspectPureSources, loadJavaScriptSources, RULE_MODULES } from "../../scripts/pure-check.mjs";

const root = fileURLToPath(new URL("../../src", import.meta.url));

test("all declared pure functions and rule modules satisfy checked boundaries", async () => {
  const result = inspectPureSources(await loadJavaScriptSources(root));
  assert.ok(result.count >= 113, `Expected functional core coverage, received ${result.count}`);
  assert.equal(RULE_MODULES.length, 13);
  assert.deepEqual(result.problems, []);
});

test("public entry is export-only and applications do not depend on CLI, presentation or other commands", async () => {
  const sources = await loadJavaScriptSources(root);
  const index = ts.createSourceFile("index.js", sources.get(resolve(root, "index.js")), ts.ScriptTarget.Latest, true);
  assert.ok(index.statements.every((node) => ts.isExportDeclaration(node)));
  const applications = new Set([
    "check-repository.js", "list-ideas.js", "whatsnext.js", "create-idea.js", "event-command.js",
  ]);
  const forbidden = new Set(["index.js", "cli.js", "response.js", "markdown.js", "tui.js", "domain.js"]);
  for (const name of applications) {
    const source = sources.get(resolve(root, name));
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    for (const node of tree.statements) {
      if (!ts.isImportDeclaration(node)) continue;
      const target = basename(node.moduleSpecifier.text);
      assert.equal(forbidden.has(target), false, `${name} -> ${target}`);
      assert.equal(applications.has(target), false, `${name} depends on another command ${target}`);
    }
  }
});

test("the complete source module graph has no dependency cycles", async () => {
  const sources = await loadJavaScriptSources(root);
  const graph = new Map([...sources].map(([path, source]) => {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const targets = tree.statements.flatMap((node) => {
      if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) return [];
      const specifier = node.moduleSpecifier.text;
      if (!specifier.startsWith(".")) return [];
      const target = resolve(dirname(path), specifier);
      assert.ok(sources.has(target), `${path} refers to missing source ${target}`);
      return [target];
    });

    return [path, targets];
  }));
  const completed = new Set();
  const active = [];
  const visit = (path) => {
    assert.equal(active.includes(path), false, `Dependency cycle: ${[...active, path].map((entry) => basename(entry)).join(" -> ")}`);
    if (completed.has(path)) return;
    active.push(path);
    for (const target of graph.get(path)) visit(target);
    active.pop();
    completed.add(path);
  };
  for (const path of graph.keys()) visit(path);
});

test("authenticated projection source identity includes the extracted digest implementation", async () => {
  const sources = await loadJavaScriptSources(root);
  const source = sources.get(resolve(root, "event-projection.js"));
  const tree = ts.createSourceFile("event-projection.js", source, ts.ScriptTarget.Latest, true);
  let coordinates;
  const visit = (node) => {
    if (ts.isArrayLiteralExpression(node)) {
      const names = node.elements.filter(ts.isStringLiteral).map(({ text }) => text);
      if (names.includes("event-projection.js")) coordinates = names;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(coordinates.includes("event-digest.js"));
  for (const name of coordinates) assert.ok(sources.has(resolve(root, name)), name);
});
