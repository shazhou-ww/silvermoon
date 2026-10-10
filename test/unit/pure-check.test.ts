import assert from "node:assert/strict";
import { test } from "node:test";

import { inspectPureSources } from "../../bin/pure-check.ts";

function inspect(
  source: string,
  extra: Iterable<readonly [string, string]> = [],
) {
  return inspectPureSources(new Map([
    ["/fixture/main.js", source],
    ...extra,
  ]), { ruleModules: [] });
}

test("accepts explicit time, owned mutation, lexical shadows and pure imported helpers", () => {
  const result = inspect(`
    import { helper } from "./helper.ts";
    /** @pure */
    function run(input, now, document, global) {
      const items = [...input];
      items.sort((left, right) => left - right);
      const record = { count: 0 };
      record.count += 1;
      items.map((record) => record + 1);
      const date = new Date(now);
      return helper(items.length + date.getTime() + document + global);
    }
  `, [["/fixture/helper.js", "/** @pure */ export function helper(value) { return value; }"]]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.problems, []);
});

test("rejects clocks, randomness, I/O aliases and mutable external reads", () => {
  const result = inspect(`
    import { readFile as read } from "node:fs/promises";
    let shared = 1;
    /** @pure */
    function run(path) {
      const reader = read;
      reader(path);
      console.log(process.env.HOME);
      return Date.now() + Math.random() + new Date().getTime() + shared;
    }
  `);
  for (const pattern of [
    /external reference read/, /unconfirmed call reader/, /external state console/,
    /external state process/, /implicit clock/, /randomness/, /mutable external binding shared/,
  ]) assert.ok(result.problems.some(({ message }) => pattern.test(message)), String(pattern));
});

test("rejects parameter, borrowed alias, callback parameter and shared mutations", () => {
  const result = inspect(`
    const shared = [];
    /** @pure */
    function run(input) {
      const alias = input.child;
      alias.count = 1;
      input.push(1);
      input.map((record) => record.count++);
      shared.push(1);
      Object.freeze(input);
      return input;
    }
  `);
  for (const name of ["alias", "input", "record", "shared"]) {
    assert.ok(result.problems.some(({ message }) => message.endsWith(`state ${name}`)), name);
  }
});

test("does not confuse local owned records with identically named callback parameters", () => {
  const result = inspect(`
    /** @pure */
    function run(input) {
      const record = { value: 0 };
      record.value = input.length;
      return input.map((record) => record.value);
    }
  `);
  assert.deepEqual(result.problems, []);
});

test("rejects unmarked local/imported calls, injected callbacks and dynamic methods", () => {
  const result = inspect(`
    import { effect } from "./helper.ts";
    function local() { return 1; }
    /** @pure */
    function run(input, callback) {
      input.map(callback);
      effect();
      local();
      callback();
      input["read"]();
      return input;
    }
  `, [["/fixture/helper.js", "export function effect() { return 1; }"]]);
  for (const pattern of [
    /unconfirmed call effect/, /unconfirmed call local/, /unconfirmed call callback/,
    /unconfirmed callback callback/, /dynamic call/,
  ]) assert.ok(result.problems.some(({ message }) => pattern.test(message)), String(pattern));
});

test("recognizes a bound arrow function marker and a pure named re-export", () => {
  const result = inspect(`
    import { helper } from "./barrel.ts";
    /** @pure */
    const run = (input) => helper(input);
  `, [
    ["/fixture/barrel.js", 'export { actual as helper } from "./helper.ts";'],
    ["/fixture/helper.js", "/** @pure */ export function actual(input) { return input; }"],
  ]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.problems, []);
});

test("recognizes a pure default function import", () => {
  const result = inspect(`
    import helper from "./helper.ts";
    /** @pure */
    function run(input) {
      return helper(input);
    }
  `, [[
    "/fixture/helper.js",
    "/** @pure */ export default function helper(value) { return value; }",
  ]]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.problems, []);
});

test("recognizes a pure default arrow function import", () => {
  const result = inspect(`
    import helper from "./helper.ts";
    /** @pure */
    function run(input) {
      return helper(input);
    }
  `, [[
    "/fixture/helper.js",
    `/** @pure */
    const helper = (value) => value;
    export default helper;`,
  ]]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.problems, []);
});

test("resolves pure imports and local bindings with Windows source paths", () => {
  const result = inspectPureSources(new Map([
    ["D:\\fixture\\main.js", `
      import { helper } from "./helper.ts";
      /** @pure */
      export function run(input) {
        const record = { value: input };
        record.value = helper(record.value);
        return record;
      }
    `],
    ["D:\\fixture\\helper.js", "/** @pure */ export function helper(value) { return value; }"],
  ]), { ruleModules: [] });
  assert.equal(result.count, 2);
  assert.deepEqual(result.problems, []);
});

test("rule boundaries reject I/O imports and missing annotations", () => {
  const result = inspectPureSources(new Map([
    ["/fixture/business/shared/evaluate-local-readiness.ts", `
      import { readFile } from "node:fs/promises";
      import { command } from "./cli.ts";
      function unmarked() { return 1; }
    `],
  ]));
  assert.ok(result.problems.some(({ message }) => /external rule dependency/.test(message)));
  assert.ok(result.problems.some(({ message }) => /non-rule module/.test(message)));
  assert.ok(result.problems.some(({ message }) => /missing @pure/.test(message)));
});
