import { readFile, readdir } from "node:fs/promises";
import { dirname, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

export const RULE_MODULES = Object.freeze([
  "foundation/command-message/observation.ts", "foundation/report/projection.ts",
  "foundation/renderer/markdown.ts", "foundation/report/instructions.ts",
  "business/shared/evaluate-local-readiness.ts",
  "business/shared/evaluate-primary-relation.ts", "foundation/report/observation.ts",
  "foundation/event-reducer/policy.ts", "foundation/event-store/digest.ts",
  "foundation/scaffold-plan/scaffold-plan.ts", "foundation/idea-model/ulid.ts",
  "foundation/project-config/rules.ts", "foundation/skill-registration/rules.ts",
  "foundation/guidance/rules.ts", "foundation/idea-query/rules.ts",
]);
const RULE_ENTRYPOINTS = new Set([
  "foundation/event-codec/index.ts", "foundation/event-reducer/index.ts",
  "foundation/idea-model/index.ts",
  "foundation/idea-template/index.ts", "foundation/language/index.ts",
  "foundation/coordinates/index.ts", "foundation/schema/index.ts",
]);
const RULE_DEPENDENCIES = new Set([
  ...RULE_MODULES, ...RULE_ENTRYPOINTS, "foundation/report/dialogue.ts",
  "foundation/language/language.ts", "foundation/idea-model/status.ts",
  "foundation/event-codec/grammar.ts", "foundation/idea-template/templates.ts",
  "foundation/coordinates/layout.ts", "foundation/schema/yaml.ts",
  "foundation/coordinates/repository.ts", "foundation/schema/schema.ts",
  "foundation/event-store/digest.ts",
  "foundation/language/index.ts", "foundation/coordinates/index.ts",
  "foundation/schema/index.ts", "foundation/event-codec/index.ts",
  "foundation/event-history/index.ts", "foundation/idea-template/index.ts",
  "foundation/git/index.ts", "foundation/project-config/index.ts",
  "foundation/renderer/index.ts", "foundation/report/index.ts",
  "foundation/report/templates/whats-next/index.ts",
  "business/shared/business-types.ts",
]);
const EXTERNAL_FUNCTIONS = new Map([
  ["node:crypto", new Set(["createHash"])],
  ["node:url", new Set(["URL"])],
  ["node:util", new Set(["isDeepStrictEqual"])],
  ["yaml", new Set([
    "isAlias", "isMap", "isNode", "isScalar", "parseDocument", "stringify", "visit",
  ])],
  ["mdast-util-from-markdown", new Set(["fromMarkdown"])],
]);
const GLOBAL_FUNCTIONS = new Set([
  "String", "Number", "Boolean", "BigInt", "structuredClone", "parseInt", "parseFloat",
]);
const CONSTRUCTORS = new Set([
  "Error", "TypeError", "RangeError", "Map", "Set", "RegExp", "TextDecoder", "URL",
]);
const FORBIDDEN_GLOBALS = new Set([
  "process", "console", "globalThis", "global", "window", "document", "performance",
  "fetch", "setTimeout", "setInterval", "queueMicrotask", "crypto",
]);
const METHODS = new Set([
  "at", "map", "filter", "reduce", "some", "every", "find", "findIndex", "flatMap",
  "slice", "subarray", "split", "join", "includes", "startsWith", "endsWith", "trim",
  "toLowerCase", "toUpperCase", "replace", "replaceAll", "match", "matchAll", "test",
  "exec", "indexOf", "padStart", "repeat", "toString", "toISOString", "getTime",
  "getUTCFullYear", "getUTCMonth", "getUTCDate", "get", "has", "entries", "values",
  "keys", "equals", "decode", "toJS", "update", "digest",
]);
const MUTATORS = new Set([
  "push", "pop", "shift", "unshift", "sort", "reverse", "splice", "set", "add",
  "delete", "clear", "fill", "copyWithin", "setUTCFullYear", "setUTCHours",
]);
const STATIC_CALLS = new Set([
  "Object.keys", "Object.values", "Object.entries", "Object.fromEntries", "Object.hasOwn",
  "Object.freeze", "Object.isFrozen", "Object.assign", "Object.defineProperty",
  "Array.isArray", "Array.from", "ArrayBuffer.isView", "JSON.parse",
  "JSON.stringify", "Number.isFinite", "Number.isInteger", "Number.isSafeInteger",
  "Date.parse", "Math.max", "Math.min", "Math.abs", "Math.floor", "Math.round",
  "Math.ceil", "Math.trunc", "Intl.getCanonicalLocales", "Buffer.from", "Buffer.alloc",
  "Buffer.concat", "Buffer.compare", "Buffer.byteLength", "Buffer.isBuffer",
]);

type PureProblem = { path: string; line: number; message: string };

function pure(node: ts.Node): boolean {
  return ts.getJSDocTags(node).some(({ tagName }) => tagName.text === "pure");
}

function rootName(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
    || ts.isParenthesizedExpression(node)) return rootName(node.expression);
  return undefined;
}

function rootIdentifier(node: ts.Node | undefined): ts.Identifier | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node)) return node;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
    || ts.isParenthesizedExpression(node)) return rootIdentifier(node.expression);
  return undefined;
}

function matchesCoordinate(path: string, coordinate: string): boolean {
  return path.replaceAll("\\", "/").endsWith(`/${coordinate}`);
}

function normalizeSourcePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function resolveSourcePath(
  path: string,
  specifier: string,
  knownPaths?: ReadonlySet<string>,
): string {
  const resolved = posix.normalize(posix.join(posix.dirname(path), specifier));
  if (knownPaths?.has(resolved)) return resolved;
  const builtPath = resolved.replace(/\.ts$/, ".js");
  return knownPaths?.has(builtPath) ? builtPath : resolved;
}

export function inspectPureSources(
  sources: ReadonlyMap<string, string> | Iterable<readonly [string, string]>,
  { ruleModules = RULE_MODULES }: { ruleModules?: readonly string[] } = {},
): { count: number; problems: PureProblem[] } {
  const normalizedSources = new Map(
    [...sources].map(([path, source]) => [normalizeSourcePath(path), source]),
  );
  const sourcePaths = new Set(normalizedSources.keys());
  const modules = new Map([...normalizedSources].map(([path, source]) => {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const functions = new Map();
    const imports = new Map();
    const exports = new Map();
    const classes = new Set();
    for (const node of tree.statements) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.set(node.name.text, node);
        exports.set(node.name.text, { local: node.name.text });
        if (node.modifiers?.some(({ kind }) =>
          kind === ts.SyntaxKind.DefaultKeyword
        )) {
          exports.set("default", { local: node.name.text });
        }
      }
      if (ts.isClassDeclaration(node) && node.name
        && node.heritageClauses?.some((clause) =>
          clause.types.some((type) => type.expression.getText(tree) === "Error"))) {
        classes.add(node.name.text);
      }
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer
            && (ts.isArrowFunction(declaration.initializer)
              || ts.isFunctionExpression(declaration.initializer))) {
            functions.set(declaration.name.text,
              pure(node) ? node : declaration.initializer);
          }
        }
      }
      if (ts.isImportDeclaration(node) && node.importClause) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) continue;
        const specifier = node.moduleSpecifier.text;
        const target = specifier.startsWith(".")
          ? resolveSourcePath(path, specifier, sourcePaths) : specifier;
        const clause = node.importClause;
        if (clause.isTypeOnly) continue;
        if (clause.name) imports.set(clause.name.text, { target, name: "default" });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const entry of clause.namedBindings.elements) {
            if (entry.isTypeOnly) continue;
            imports.set(entry.name.text, {
              target, name: entry.propertyName?.text ?? entry.name.text,
            });
          }
        } else if (clause.namedBindings) {
          imports.set(clause.namedBindings.name.text, { target, name: "*" });
        }
      }
      if (ts.isExportDeclaration(node) && node.exportClause
        && ts.isNamedExports(node.exportClause)) {
        if (node.isTypeOnly) continue;
        const target = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text : undefined;
        for (const entry of node.exportClause.elements) {
          if (entry.isTypeOnly) continue;
          exports.set(entry.name.text, target
            ? { target: resolveSourcePath(path, target, sourcePaths), name: entry.propertyName?.text ?? entry.name.text }
            : { local: entry.propertyName?.text ?? entry.name.text });
        }
      }
      if (ts.isExportAssignment(node) && !node.isExportEquals
        && ts.isIdentifier(node.expression)) {
        exports.set("default", { local: node.expression.text });
      }
    }
    return [path, { tree, functions, imports, exports, classes }];
  }));
  const problems: PureProblem[] = [];
  let count = 0;
  const program = ts.createProgram([...modules.keys()], {
    allowJs: true, noLib: true, noResolve: true,
  }, {
    getSourceFile: (path) => modules.get(path)?.tree,
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (path) => modules.has(path),
    readFile: (path) => normalizedSources.get(path),
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  });
  const checker = program.getTypeChecker();
  const bindingKey = (node: ts.Node | undefined): ts.Symbol | string | undefined => {
    const identifier = rootIdentifier(node);
    return identifier ? checker.getSymbolAtLocation(identifier) ?? identifier.text : undefined;
  };
  const boundNames = (name: ts.BindingName): (ts.Symbol | string | undefined)[] => {
    if (ts.isIdentifier(name)) return [bindingKey(name)];
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      return name.elements.flatMap((element) =>
        ts.isBindingElement(element) ? boundNames(element.name) : []);
    }
    return [];
  };
  const knownPure = (
    path: string,
    name: string,
    seen: Set<string> = new Set(),
  ): boolean => {
    const key = `${path}:${name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (EXTERNAL_FUNCTIONS.get(path)?.has(name)) return true;
    const module = modules.get(path);
    if (!module) return false;
    if (module.classes.has(name)) return true;
    const node = module.functions.get(name);
    if (node) return pure(node);
    const exported = module.exports.get(name);
    if (exported?.target) return knownPure(exported.target, exported.name, seen);
    if (exported?.local && exported.local !== name) return knownPure(path, exported.local, seen);
    const imported = module.imports.get(exported?.local ?? name);
    return imported ? knownPure(imported.target, imported.name, seen) : false;
  };
  for (const [path, module] of modules) {
    const report = (node: ts.Node, message: string): void => {
      const { line } = module.tree.getLineAndCharacterOfPosition(node.getStart(module.tree));
      problems.push({ path, line: line + 1, message });
    };
    if (ruleModules.some((coordinate) => matchesCoordinate(path, coordinate))
      || [...RULE_ENTRYPOINTS].some((coordinate) => matchesCoordinate(path, coordinate))) {
      for (const node of module.tree.statements) {
        if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
        if (
          (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)
          || (ts.isExportDeclaration(node) && node.isTypeOnly)
        ) continue;
        if (!ts.isStringLiteral(node.moduleSpecifier)) continue;
        const target = node.moduleSpecifier.text;
        if (target.startsWith(".")) {
          const resolved = resolveSourcePath(path, target);
          if (![...RULE_DEPENDENCIES].some((coordinate) => matchesCoordinate(resolved, coordinate))) {
            report(node, `Pure rule module depends on non-rule module ${target}`);
          }
        } else {
          const allowed = EXTERNAL_FUNCTIONS.get(target);
          const imported = [...module.imports.values()].filter((entry) => entry.target === target);
          if (!allowed || !imported.length || imported.some(({ name }) => !allowed.has(name))) {
            report(node, `Unreviewed external rule dependency ${target}`);
          }
        }
      }
      for (const [name, node] of module.functions) {
        if (!pure(node)) report(node, `Rule function ${name} is missing @pure`);
      }
    }
    for (const [name, declaration] of module.functions) {
      if (!pure(declaration)) continue;
      count += 1;
      const firstDeclaration = ts.isVariableStatement(declaration)
        ? declaration.declarationList.declarations[0] : undefined;
      const fn = firstDeclaration?.initializer ?? declaration;
      const locals = new Set();
      const borrowed = new Set();
      const callable = new Set();
      const declarations: ts.VariableDeclaration[] = [];
      const collect = (node: ts.Node): void => {
        if (ts.isParameter(node)) {
          for (const name of boundNames(node.name)) {
            locals.add(name);
            borrowed.add(name);
          }
        }
        if (ts.isCatchClause(node) && node.variableDeclaration) {
          for (const name of boundNames(node.variableDeclaration.name)) locals.add(name);
        }
        if (ts.isVariableDeclaration(node)) {
          declarations.push(node);
          for (const name of boundNames(node.name)) locals.add(name);
          if (ts.isIdentifier(node.name) && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
            callable.add(bindingKey(node.name));
          }
        }
        if (ts.isFunctionDeclaration(node) && node.name && node !== fn) {
          locals.add(bindingKey(node.name));
          callable.add(bindingKey(node.name));
        }
        ts.forEachChild(node, collect);
      };
      collect(fn);
      for (let pass = 0; pass <= declarations.length; pass++) {
        for (const entry of declarations) {
          if (borrowed.has(bindingKey(entry.initializer))) {
            for (const name of boundNames(entry.name)) borrowed.add(name);
          }
        }
      }
      const checkWrite = (node: ts.Node, target: ts.Node, objectMutation = false): void => {
        const root = bindingKey(target);
        if (root && (((objectMutation || !ts.isIdentifier(target)) && borrowed.has(root)) || !locals.has(root))) {
          report(node, `${name}: modifies input or external state ${rootName(target)}`);
        }
      };
      const visit = (node: ts.Node): void => {
        if (ts.isTypeNode(node)) return;
        if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)
          && !locals.has(bindingKey(node))
          && !locals.has(node.text)
          && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
          && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) {
          report(node, `${name}: external state ${node.text}`);
        }
        if (ts.isIdentifier(node)
          && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
          && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) {
          const symbol = checker.getSymbolAtLocation(node);
          if (symbol?.declarations?.some((entry) => ts.isVariableDeclaration(entry)
            && ts.isVariableDeclarationList(entry.parent)
            && !(entry.parent.flags & ts.NodeFlags.Const)
            && !locals.has(bindingKey(node)))) {
            report(node, `${name}: reads mutable external binding ${node.text}`);
          }
          const imported = module.imports.get(node.text);
          if (imported && symbol?.declarations?.some((entry) =>
            ts.isImportSpecifier(entry) || ts.isImportClause(entry) || ts.isNamespaceImport(entry))
            && !modules.has(imported.target)
            && !EXTERNAL_FUNCTIONS.get(imported.target)?.has(imported.name)) {
            report(node, `${name}: unreviewed external reference ${node.text}`);
          }
        }
        if (ts.isBinaryExpression(node)
          && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
          && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
          checkWrite(node, node.left);
        }
        if (ts.isDeleteExpression(node)
          || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
            && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))) {
          checkWrite(node, ts.isDeleteExpression(node) ? node.expression : node.operand);
        }
        if (ts.isNewExpression(node)) {
          const ctor = node.expression.getText(module.tree);
          if (ctor === "Date") {
            if (!node.arguments?.length) report(node, `${name}: implicit clock`);
          } else if (!CONSTRUCTORS.has(ctor) && !knownPure(path, ctor)) {
            report(node, `${name}: unreviewed constructor ${ctor}`);
          }
        }
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const text = expression.getText(module.tree);
          if (ts.isIdentifier(expression)) {
            const imported = module.imports.get(text);
            if (!(GLOBAL_FUNCTIONS.has(text) && !locals.has(bindingKey(expression)))
              && !callable.has(bindingKey(expression))
              && !(imported ? knownPure(imported.target, imported.name) : knownPure(path, text))) {
              report(node, `${name}: unconfirmed call ${text}`);
            }
          } else if (ts.isPropertyAccessExpression(expression)) {
            const method = expression.name.text;
            if (["Date.now", "Math.random"].includes(text)) {
              report(node, `${name}: implicit clock or randomness ${text}`);
            } else if (text === "Object.freeze" && !locals.has(bindingKey(expression.expression))) {
              const argument = node.arguments[0];
              if (argument) checkWrite(node, argument, true);
            } else if (MUTATORS.has(method)) {
              checkWrite(node, expression.expression, true);
            } else if (!(STATIC_CALLS.has(text) && !locals.has(bindingKey(expression.expression)))
              && !METHODS.has(method)) {
              report(node, `${name}: unreviewed method ${text}`);
            }
            if (["map", "filter", "reduce", "some", "every", "find", "findIndex", "flatMap", "sort"]
              .includes(method) && node.arguments.length) {
              const callback = node.arguments[0];
              if (callback && ts.isIdentifier(callback)) {
                const imported = module.imports.get(callback.text);
                if (!callable.has(bindingKey(callback))
                  && !(GLOBAL_FUNCTIONS.has(callback.text) && !locals.has(bindingKey(callback)))
                  && !(imported ? knownPure(imported.target, imported.name) : knownPure(path, callback.text))) {
                  report(node, `${name}: unconfirmed callback ${callback.text}`);
                }
              } else if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
                report(node, `${name}: dynamic callback requires explicit review`);
              }
            }
          } else {
            report(node, `${name}: dynamic call requires explicit review`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(fn);
    }
  }
  return { count, problems };
}

export async function loadJavaScriptSources(root: string): Promise<Map<string, string>> {
  const entries = await readdir(root, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return loadJavaScriptSources(path);
    return entry.isFile() && /\.(?:js|mjs|ts)$/.test(entry.name)
      ? new Map([[path, await readFile(path, "utf8")]]) : new Map();
  }));
  return new Map(groups.flatMap((group: Map<string, string>) => [...group]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  const result = inspectPureSources(await loadJavaScriptSources(root));
  if (result.problems.length) {
    for (const problem of result.problems) {
      process.stderr.write(`${relative(dirname(root), problem.path)}:${problem.line}: ${problem.message}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(`PURE_CHECK_OK functions=${result.count} ruleModules=${RULE_MODULES.length}\n`);
  }
}
