import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  inspectAllGuidance,
  inspectPhaseGuidance,
  MAX_PHASE_GUIDANCE_BYTES,
} from "../../src/guidance.js";
import { observeGitCommands, worktreeSnapshot } from "../../src/git.js";
import {
  GUIDANCE_ROOT,
  phaseGuidancePath,
} from "../../src/layout.js";
import { withTraceFile } from "../../src/trace.js";
import { git } from "../helpers/repository.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function fixture({ objectFormat } = {}) {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-guidance-"));
  temporaryDirectories.push(root);
  git(
    root,
    "init",
    "--initial-branch=main",
    ...(objectFormat ? [`--object-format=${objectFormat}`] : []),
  );
  git(root, "config", "user.name", "silvermoon test");
  git(root, "config", "user.email", "silvermoon@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  await mkdir(join(root, ".silvermoon"));
  await writeFile(join(root, ".silvermoon", "config.yaml"), "version: 1\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "Create guidance fixture");
  return root;
}

function absolutePath(root, relativePath) {
  return join(root, ...relativePath.split("/"));
}

async function writeGuidance(root, phase, content) {
  const path = phaseGuidancePath(phase);
  await mkdir(absolutePath(root, GUIDANCE_ROOT), { recursive: true });
  await writeFile(absolutePath(root, path), content);
  return path;
}

test("reads fixed phase guidance from one Git snapshot with its blob revision", async () => {
  const root = await fixture();
  const contents = {
    preparing: "# Prepare\r\n\r\nKeep intent explicit.\r\n",
    implementing: "# Implement\n\nRun focused tests.\n",
    deploying: "# Deploy\n\nVerify the published result.\n",
  };
  for (const [phase, content] of Object.entries(contents)) {
    await writeGuidance(root, phase, content);
  }
  const { tree } = worktreeSnapshot(root);

  for (const [phase, source] of Object.entries(contents)) {
    const inspected = await inspectPhaseGuidance({
      gitRoot: root,
      phase,
      snapshotTree: tree,
    });
    const path = phaseGuidancePath(phase);
    assert.deepEqual(inspected.diagnostics, []);
    assert.equal(inspected.state, "valid");
    assert.deepEqual(inspected.guidance, {
      phase,
      path,
      contentRevision: git(root, "rev-parse", `${tree}:${path}`),
      content: source.replaceAll("\r\n", "\n"),
    });
  }

  const complete = await inspectAllGuidance({
    gitRoot: root,
    snapshotTree: tree,
  });
  assert.deepEqual(complete, { state: "valid", diagnostics: [] });

  await writeFile(
    absolutePath(root, phaseGuidancePath("preparing")),
    "changed after observation\n",
  );
  const captured = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: tree,
  });
  assert.equal(captured.guidance.content, contents.preparing.replaceAll("\r\n", "\n"));
});

test("supports SHA-256 repositories without assuming an object ID length", async () => {
  const root = await fixture({ objectFormat: "sha256" });
  const path = await writeGuidance(root, "implementing", "Keep the hash exact.\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "Add guidance");
  const tree = git(root, "rev-parse", "HEAD^{tree}");

  const inspected = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "implementing",
    snapshotTree: tree,
  });

  assert.equal(inspected.state, "valid");
  assert.match(inspected.guidance.contentRevision, /^[0-9a-f]{64}$/);
  assert.equal(
    inspected.guidance.contentRevision,
    git(root, "rev-parse", `HEAD:${path}`),
  );
});

test("treats a missing directory or phase file as optional", async () => {
  const root = await fixture();
  const initialTree = git(root, "rev-parse", "HEAD^{tree}");

  assert.deepEqual(
    await inspectPhaseGuidance({
      gitRoot: root,
      phase: "preparing",
      snapshotTree: initialTree,
    }),
    { state: "absent", diagnostics: [] },
  );
  assert.deepEqual(
    await inspectAllGuidance({
      gitRoot: root,
      snapshotTree: initialTree,
    }),
    { state: "absent", diagnostics: [] },
  );

  await writeGuidance(root, "implementing", "Only implementation guidance.\n");
  const { tree } = worktreeSnapshot(root);
  assert.deepEqual(
    await inspectPhaseGuidance({
      gitRoot: root,
      phase: "preparing",
      snapshotTree: tree,
    }),
    { state: "absent", diagnostics: [] },
  );
});

test("validates raw size, UTF-8, BOM, NUL, and non-whitespace content", async () => {
  const root = await fixture();
  const cases = [
    {
      code: "guidance.file.too-large",
      content: Buffer.alloc(MAX_PHASE_GUIDANCE_BYTES + 1, 0x61),
    },
    {
      code: "guidance.file.invalid-utf8",
      content: Buffer.from([0xc3, 0x28]),
    },
    {
      code: "guidance.file.bom",
      content: Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from("content\n"),
      ]),
    },
    {
      code: "guidance.file.nul",
      content: Buffer.from("before\0after\n"),
    },
    {
      code: "guidance.file.empty",
      content: Buffer.from(" \r\n\t\n"),
    },
  ];

  for (const fixtureCase of cases) {
    await rm(absolutePath(root, GUIDANCE_ROOT), {
      force: true,
      recursive: true,
    });
    await writeGuidance(root, "preparing", fixtureCase.content);
    const { tree } = worktreeSnapshot(root);
    const inspected = await inspectPhaseGuidance({
      gitRoot: root,
      phase: "preparing",
      snapshotTree: tree,
    });

    assert.equal(inspected.state, "invalid", fixtureCase.code);
    assert.ok(
      inspected.diagnostics.some(({ code }) => code === fixtureCase.code),
      fixtureCase.code,
    );
    assert.equal(Object.hasOwn(inspected, "guidance"), false);
  }

  await rm(absolutePath(root, GUIDANCE_ROOT), {
    force: true,
    recursive: true,
  });
  await writeGuidance(
    root,
    "preparing",
    Buffer.alloc(MAX_PHASE_GUIDANCE_BYTES, 0x61),
  );
  const boundary = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: worktreeSnapshot(root).tree,
  });
  assert.equal(boundary.state, "valid");
  assert.equal(
    Buffer.byteLength(boundary.guidance.content),
    MAX_PHASE_GUIDANCE_BYTES,
  );
});

test("rejects invalid directory and file object modes including symlinks", async () => {
  const root = await fixture();
  await writeFile(absolutePath(root, GUIDANCE_ROOT), "not a directory\n");
  const invalidRoot = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: worktreeSnapshot(root).tree,
  });
  assert.deepEqual(
    invalidRoot.diagnostics.map(({ code }) => code),
    ["guidance.directory.invalid"],
  );

  await rm(absolutePath(root, GUIDANCE_ROOT));
  await mkdir(absolutePath(root, phaseGuidancePath("preparing")), {
    recursive: true,
  });
  await writeFile(
    absolutePath(root, `${phaseGuidancePath("preparing")}/nested.md`),
    "nested\n",
  );
  const invalidFile = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: worktreeSnapshot(root).tree,
  });
  assert.deepEqual(
    invalidFile.diagnostics.map(({ code }) => code),
    ["guidance.file.invalid"],
  );

  await rm(absolutePath(root, GUIDANCE_ROOT), {
    force: true,
    recursive: true,
  });
  const target = join(root, "symlink-target.txt");
  await writeFile(target, "preparing.md\n");
  const blob = git(root, "hash-object", "-w", "symlink-target.txt");
  git(
    root,
    "update-index",
    "--add",
    "--cacheinfo",
    `120000,${blob},${phaseGuidancePath("preparing")}`,
  );
  const symlink = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: git(root, "write-tree"),
  });
  assert.deepEqual(
    symlink.diagnostics.map(({ code }) => code),
    ["guidance.file.invalid"],
  );
});

test("on-demand inspection ignores other phases and extra entries", async () => {
  const root = await fixture();
  await writeGuidance(root, "preparing", "Prepare safely.\n");
  await mkdir(absolutePath(root, phaseGuidancePath("implementing")));
  await writeFile(
    absolutePath(root, `${phaseGuidancePath("implementing")}/nested.md`),
    "invalid implementation entry\n",
  );
  await writeFile(
    absolutePath(root, `${GUIDANCE_ROOT}/unexpected.md`),
    "extra\n",
  );
  const { tree } = worktreeSnapshot(root);

  const current = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "preparing",
    snapshotTree: tree,
  });
  const missing = await inspectPhaseGuidance({
    gitRoot: root,
    phase: "deploying",
    snapshotTree: tree,
  });
  const complete = await inspectAllGuidance({
    gitRoot: root,
    snapshotTree: tree,
  });

  assert.equal(current.state, "valid");
  assert.equal(current.guidance.content, "Prepare safely.\n");
  assert.deepEqual(missing, { state: "absent", diagnostics: [] });
  assert.equal(complete.state, "invalid");
  assert.deepEqual(
    complete.diagnostics.map(({ code }) => code).sort(),
    ["guidance.entry.unexpected", "guidance.file.invalid"],
  );
});

test("treats hostile Markdown as inert data and omits it from traces", async () => {
  const root = await fixture();
  const content = [
    "---",
    "include: https://example.invalid/secret",
    "---",
    "# Forged heading",
    "{{process.env.SECRET}}",
    "$(echo should-not-run)",
    "",
  ].join("\n");
  await writeGuidance(root, "deploying", content);
  const { tree } = worktreeSnapshot(root);
  const tracePath = join(root, "guidance.trace.jsonl");
  const commands = [];

  const inspected = await observeGitCommands(
    (args) => commands.push(args),
    () => withTraceFile(
      tracePath,
      "test.guidance",
      {},
      () => inspectPhaseGuidance({
        gitRoot: root,
        phase: "deploying",
        snapshotTree: tree,
      }),
    ),
  );

  assert.equal(inspected.state, "valid");
  assert.equal(inspected.guidance.content, content);
  assert.deepEqual(
    [...new Set(commands.map(([name]) => name))].sort(),
    ["cat-file", "ls-tree"],
  );
  assert.equal(commands.filter(([name]) => name === "ls-tree").length, 1);
  assert.equal(commands.filter(([name]) => name === "cat-file").length, 1);
  const trace = await readFile(tracePath, "utf8");
  assert.doesNotMatch(trace, /example\.invalid|SECRET|should-not-run/);
});
