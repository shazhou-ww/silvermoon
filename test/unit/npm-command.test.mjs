import assert from "node:assert/strict";
import { test } from "node:test";
import { npmCommand } from "../../scripts/npm-command.mjs";

test("npm package tools use PATH on POSIX and a shell-free npm CLI on Windows", () => {
  const args = ["pack", "--pack-destination", "directory with spaces"];
  for (const platform of ["linux", "darwin"]) {
    assert.deepEqual(npmCommand(args, {
      platform, execPath: "/opt/node/bin/node", env: { npm_execpath: "/tools/pnpm.cjs" },
    }), { command: "npm", args });
  }
  const execPath = "C:\\Program Files\\nodejs\\node.exe";
  assert.deepEqual(npmCommand(args, {
    platform: "win32", execPath, env: { npm_execpath: "C:\\tools\\pnpm.exe" },
  }), {
    command: execPath,
    args: ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js", ...args],
  });
  assert.deepEqual(npmCommand(args, {
    platform: "win32", execPath, env: { npm_execpath: "D:\\custom npm\\npm-cli.js" },
  }), { command: execPath, args: ["D:\\custom npm\\npm-cli.js", ...args] });
  assert.deepEqual(args, ["pack", "--pack-destination", "directory with spaces"]);
});
