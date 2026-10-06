import assert from "node:assert/strict";
import { ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { lookup, resolve4, Resolver } from "node:dns";
import { get } from "node:https";
import { connect, Server, Socket } from "node:net";
import { test } from "node:test";
import { installSanityGuard } from "../helpers/sanity-guard.ts";

test("sanity forbids real processes and network even through named builtin imports", () => {
  installSanityGuard();
  const child = new ChildProcess();
  const childSpawn: unknown = Reflect.get(child, "spawn");
  assert.equal(typeof childSpawn, "function");
  if (typeof childSpawn !== "function") {
    throw new Error("ChildProcess.spawn must be callable");
  }
  for (const attempt of [
    () => spawn("git", ["--version"]),
    () => spawnSync("npm", ["install"]),
    () => execFileSync(process.execPath, ["--version"]),
    () => Reflect.apply(childSpawn, child, [{ file: "git", args: ["git", "--version"] }]),
    () => connect(443, "example.test"),
    () => new Socket().connect(443, "example.test"),
    () => new Server().listen(0),
    () => get("https://example.test"),
    () => lookup("example.test", () => {}),
    () => resolve4("example.test", () => {}),
    () => new Resolver().resolve4("example.test", () => {}),
    () => fetch("https://example.test"),
  ]) {
    assert.throws(attempt, /SANITY_IO_FORBIDDEN/);
  }
});
