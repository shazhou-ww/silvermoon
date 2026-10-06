import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { observeGitCommands } from "../../src/foundation/git/index.ts";
import { inspectIdeaLayout } from "../../src/business/shared/idea-layout.ts";
import { serializeIdeaStatus } from "../../src/foundation/idea-model/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";

const temporaryDirectories: string[] = [];
const id = "01M36QGPNTXEPP61DA4KP4AVZF";
const config = {
  version: 1 as const,
  primaryRepository: "https://example.test/owner/repository.git",
  primaryBranch: "main",
};

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function writeIdea(root: string, ideaId = id, status = {}) {
  const paths = ideaPaths(ideaId);
  await mkdir(join(root, ...paths.idealPath.split("/")), { recursive: true });
  await writeFile(join(root, ...paths.ideaDocumentPath.split("/")), "# Ideal\n");
  await writeFile(
    join(root, ...paths.implementationDocumentPath.split("/")),
    "# Implementation\n",
  );
  await writeFile(
    join(root, ...paths.deploymentDocumentPath.split("/")),
    "# Deployment\n",
  );
  await writeFile(join(root, ...paths.ledgerPath.split("/")), "# Ledger\n");
  await writeFile(
    join(root, ...paths.statusPath.split("/")),
    serializeIdeaStatus({ version: 1, id: ideaId, ...status }),
  );
  return paths;
}

async function createRepository({
  objectFormat,
}: { objectFormat?: "sha1" | "sha256" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-ideas-"));
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
  await writeIdea(root, id, { alias: "publish-documentation" });
  git(root, "add", ".");
  git(root, "commit", "-m", "Create idea");
  return root;
}

function inspect(
  root: string,
  options: Omit<
    Parameters<typeof inspectIdeaLayout>[0],
    "config" | "root"
  > = {},
) {
  return inspectIdeaLayout({ config, root, ...options });
}

function firstIdea(
  inspected: Awaited<ReturnType<typeof inspectIdeaLayout>>,
) {
  const idea = inspected.ideas.at(0);
  assert.ok(idea);
  return idea;
}

test("derives three nested world tree revisions", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  const inspected = await inspect(root);

  assert.deepEqual(inspected.diagnostics, []);
  assert.equal(inspected.ideas.length, 1);
  const idea = firstIdea(inspected);
  assert.equal(idea.id, id);
  assert.equal(idea.state, "preparing");
  assert.deepEqual(
    Object.values(idea.worlds).map(({ name, displayName }) => [name, displayName]),
    [
      ["Ideal World", "理想世界"],
      ["Inner World", "主体世界"],
      ["Outer World", "现实世界"],
    ],
  );
  assert.equal(idea.idealRevision, git(root, "rev-parse", `HEAD:${paths.idealPath}`));
  assert.equal(
    idea.implementationRevision,
    git(root, "rev-parse", `HEAD:${paths.innerPath}`),
  );
  assert.equal(
    idea.deploymentRevision,
    git(root, "rev-parse", `HEAD:${paths.outerPath}`),
  );
});

test("derives SHA-256 world revisions from the shared snapshot", async () => {
  const root = await createRepository({ objectFormat: "sha256" });

  const inspected = await inspect(root);

  assert.deepEqual(inspected.diagnostics, []);
  for (const revision of Object.values(firstIdea(inspected).revisions)) {
    assert.match(revision, /^[0-9a-f]{64}$/);
  }
});

test("uses a constant Git command budget for worktree and immutable snapshots", async () => {
  const root = await createRepository();
  const prefix = id.slice(0, -1);
  for (const suffix of "0123456789ABC") {
    await writeIdea(root, `${prefix}${suffix}`);
  }
  const worktreeCommands: (readonly string[])[] = [];

  const worktree = await observeGitCommands(
    (args) => worktreeCommands.push(args),
    () => inspect(root),
  );

  assert.deepEqual(worktree.diagnostics, []);
  assert.equal(worktree.ideas.length, 14);
  assert.deepEqual(
    worktreeCommands.map(([name]) => name),
    ["read-tree", "add", "write-tree", "cat-file"],
  );
  assert.deepEqual(
    worktreeCommands.at(1)?.slice(-2),
    ["--", ".silvermoon/ideas"],
  );

  git(root, "add", ".");
  git(root, "commit", "-m", "Add performance fixture ideas");
  const snapshotTree = git(root, "rev-parse", "HEAD^{tree}");
  const snapshotCommands: (readonly string[])[] = [];
  const snapshot = await observeGitCommands(
    (args) => snapshotCommands.push(args),
    () => inspect(root, { snapshotTree }),
  );

  assert.deepEqual(snapshot.diagnostics, []);
  assert.equal(snapshot.ideas.length, 14);
  assert.deepEqual(snapshotCommands.map(([name]) => name), ["cat-file"]);
  assert.deepEqual(
    snapshot.ideas.map(({ revisions }: { revisions: Record<string, string> }) => revisions),
    worktree.ideas.map(({ revisions }: { revisions: Record<string, string> }) => revisions),
  );
});

test("allows auxiliary files and cascades only through containing worlds", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  const before = firstIdea(await inspect(root));

  await writeFile(join(root, ...paths.idealPath.split("/"), "research.json"), "{}\n");
  const idealChanged = firstIdea(await inspect(root));
  assert.notEqual(idealChanged.idealRevision, before.idealRevision);
  assert.notEqual(idealChanged.implementationRevision, before.implementationRevision);
  assert.notEqual(idealChanged.deploymentRevision, before.deploymentRevision);

  await rm(join(root, ...paths.idealPath.split("/"), "research.json"));
  await writeFile(join(root, ...paths.innerPath.split("/"), "architecture.svg"), "<svg/>\n");
  const innerChanged = firstIdea(await inspect(root));
  assert.equal(innerChanged.idealRevision, before.idealRevision);
  assert.notEqual(innerChanged.implementationRevision, before.implementationRevision);
  assert.notEqual(innerChanged.deploymentRevision, before.deploymentRevision);

  await rm(join(root, ...paths.innerPath.split("/"), "architecture.svg"));
  await writeFile(join(root, ...paths.outerPath.split("/"), "runbook.txt"), "observe\n");
  const outerChanged = firstIdea(await inspect(root));
  assert.equal(outerChanged.idealRevision, before.idealRevision);
  assert.equal(outerChanged.implementationRevision, before.implementationRevision);
  assert.notEqual(outerChanged.deploymentRevision, before.deploymentRevision);
});

test("does not include status facts in world revisions", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  const before = firstIdea(await inspect(root));
  await writeFile(
    join(root, ...paths.statusPath.split("/")),
    serializeIdeaStatus({ version: 1, id, alias: "renamed" }),
  );

  const after = firstIdea(await inspect(root));
  assert.deepEqual(after.revisions, before.revisions);
});

test("requires a ledger without including it in world revisions", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  const before = firstIdea(await inspect(root));

  await writeFile(join(root, ...paths.ledgerPath.split("/")), "# Updated ledger\n");
  const edited = firstIdea(await inspect(root));
  assert.deepEqual(edited.revisions, before.revisions);
  assert.equal(edited.ledgerPath, paths.ledgerPath);

  await rm(join(root, ...paths.ledgerPath.split("/")));
  const missing = await inspect(root);
  assert.deepEqual(firstIdea(missing).revisions, before.revisions);
  assert.ok(
    missing.diagnostics.some(({ code }) => code === "idea.ledger.missing-file"),
  );

  await mkdir(join(root, ...paths.ledgerPath.split("/")));
  const invalid = await inspect(root);
  assert.ok(
    invalid.diagnostics.some(({ code }) => code === "idea.ledger.invalid-file"),
  );
});

test("derives preparing, implementing, and deploying from nested world changes", async () => {
  const cases = [
    {
      expected: "preparing",
      mutate: async (root: string, paths: { idealPath: string; }) => writeFile(
        join(root, ...paths.idealPath.split("/"), "changed.txt"),
        "ideal\n",
      ),
    },
    {
      expected: "implementing",
      mutate: async (root: string, paths: { innerPath: string; }) => writeFile(
        join(root, ...paths.innerPath.split("/"), "changed.txt"),
        "inner\n",
      ),
    },
    {
      expected: "deploying",
      mutate: async (root: string, paths: { outerPath: string; }) => writeFile(
        join(root, ...paths.outerPath.split("/"), "changed.txt"),
        "outer\n",
      ),
    },
  ];
  for (const fixture of cases) {
    const root = await createRepository();
    const paths = ideaPaths(id);
    const current = firstIdea(await inspect(root));
    await writeFile(
      join(root, ...paths.statusPath.split("/")),
      serializeIdeaStatus({
        version: 1,
        id,
        alias: "publish-documentation",
        approvedRevision: current.idealRevision,
        implementationAcceptedRevision: current.implementationRevision,
        deploymentAcceptedRevision: current.deploymentRevision,
      }),
    );
    assert.equal(firstIdea(await inspect(root)).state, "completed");
    await fixture.mutate(root, paths);
    assert.equal(
      firstIdea(await inspect(root)).state,
      fixture.expected,
    );
  }
});

test("rejects missing world entries, duplicate aliases, and mismatched status ids", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  await rm(join(root, ...paths.ideaDocumentPath.split("/")));
  await writeFile(
    join(root, ...paths.ideaPath.split("/"), "legacy.status.yaml"),
    "version: 1\n",
  );
  const second = "01M36QGPQ4H3R0K4N7Y6W2S8JC";
  await writeIdea(root, second, { id, alias: "publish-documentation"   });

  const inspected = await inspect(root);
  const codes = inspected.diagnostics.map(({ code }) => code);
  assert.ok(codes.includes("idea.world.missing-document"));
  assert.ok(codes.includes("idea.status.unexpected-file"));
  assert.ok(codes.includes("idea.status.id-mismatch"));
  assert.ok(codes.includes("idea.alias.duplicate"));
});

test("rejects an alias that collides with any exact idea ULID", async () => {
  const root = await createRepository();
  const second = "01M36QGPNTXEPP61DA4KP4AVG0";
  await writeIdea(root, second, { alias: id });

  const inspected = await inspect(root);

  assert.ok(
    inspected.diagnostics.some(
      ({ code }) => code === "idea.alias.id-collision",
    ),
  );
});

test("derives lifecycle without requiring historical revision objects", async () => {
  const root = await createRepository();
  const paths = ideaPaths(id);
  const current = firstIdea(await inspect(root));
  const historicalRevision = "0".repeat(40);
  const cases = [
    {
      state: "preparing",
      status: {
        approvedRevision: historicalRevision,
      },
    },
    {
      state: "implementing",
      status: {
        approvedRevision: current.idealRevision,
        implementationAcceptedRevision: historicalRevision,
      },
    },
    {
      state: "deploying",
      status: {
        approvedRevision: current.idealRevision,
        implementationAcceptedRevision: current.implementationRevision,
        deploymentAcceptedRevision: historicalRevision,
      },
    },
  ];

  for (const fixture of cases) {
    await writeFile(
      join(root, ...paths.statusPath.split("/")),
      serializeIdeaStatus({
        version: 1,
        id,
        alias: "publish-documentation",
        ...fixture.status,
      }),
    );
    const inspected = await inspect(root);
    assert.deepEqual(inspected.diagnostics, []);
    assert.equal(firstIdea(inspected).state, fixture.state);
  }
});
