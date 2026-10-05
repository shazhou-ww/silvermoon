import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dependencyInstallCommands,
  renderDependencyCommand,
  SILVERMOON_VERSION,
} from "../../src/foundation/skill-registration/index.js";

test("generates structured manager-specific root dependency commands", () => {
  assert.deepEqual(
    dependencyInstallCommands("npm", false),
    [{
      executable: "npm",
      args: ["install", "--save-dev", `silvermoon@^${SILVERMOON_VERSION}`],
    }],
  );
  assert.deepEqual(
    dependencyInstallCommands("pnpm", true),
    [{
      executable: "pnpm",
      args: ["add", "--save-dev", `silvermoon@^${SILVERMOON_VERSION}`, "--workspace-root"],
    }],
  );
  assert.deepEqual(
    dependencyInstallCommands("yarn", true),
    [
      {
        executable: "npm",
        args: ["pkg", "set", `devDependencies.silvermoon=^${SILVERMOON_VERSION}`],
      },
      { executable: "yarn", args: ["install"] },
    ],
  );
  assert.deepEqual(
    dependencyInstallCommands("bun", true),
    [{
      executable: "bun",
      args: ["add", `silvermoon@^${SILVERMOON_VERSION}`, "--dev"],
    }],
  );
  assert.equal(dependencyInstallCommands("unknown", false), null);
});

test("renders dependency commands with portable quoting for Windows and Unix shells", () => {
  const rendered = `npm install --save-dev "silvermoon@^${SILVERMOON_VERSION}"`;
  assert.equal(renderDependencyCommand("npm", false), rendered);
  assert.equal(
    renderDependencyCommand("yarn", true),
    `npm pkg set "devDependencies.silvermoon=^${SILVERMOON_VERSION}"\nyarn install`,
  );
  assert.equal(renderDependencyCommand("unknown", false), null);
});
