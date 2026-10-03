import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { createIdea } from "../../src/application/create.js";
import { observeGitCommands } from "../../src/repository/git.js";
import {
  DEPLOYMENT_TEMPLATE,
  IDEA_TEMPLATE,
  IMPLEMENTATION_TEMPLATE,
  LEDGER_TEMPLATE,
  ideaTemplates,
} from "../../src/idea/rules/templates.js";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/project/rules/layout.js";
import {
  createRepository,
  FIRST_ID,
  git,
} from "../helpers/repository.js";
import { createCreateIdeaTestHelpers } from "../helpers/create-idea.js";

const {
  fixture,
  pushPeerChange,
  repositoryState,
  responseText,
} = createCreateIdeaTestHelpers(afterEach);
const createdId = "01M38K00000000000000000001";
const secondId = "01M38K00000000000000000002";

test("creates while local primary is ahead, behind, or diverged", async () => {
  for (const relation of ["ahead", "behind", "diverged"]) {
    const repository = await fixture({ prefix: `silvermoon-create-${relation}-` });
    if (relation !== "behind") {
      await writeFile(join(repository.root, `${relation}-local.txt`), "local\n");
      git(repository.root, "add", ".");
      git(repository.root, "commit", "-m", `Create ${relation} local commit`);
    }
    if (relation !== "ahead") {
      await pushPeerChange(repository);
    }

    const commands = [];
    const report = await observeGitCommands(
      (args) => commands.push(args),
      () => createIdea({
        generateId: () => relation === "ahead" ? createdId : secondId,
        root: repository.root,
        userHome: repository.base,
      }),
    );

    assert.equal(report.observation.state, "idea-created", relation);
    assert.equal(
      commands.some(([name]) => name === "fetch" || name === "ls-remote"),
      false,
      relation,
    );
  }
});

test("[create-primary-branch] accepts a topic branch tracking configured primary without fetching", async () => {
  const repository = await fixture();
  git(repository.root, "checkout", "-b", "feature");
  git(repository.root, "branch", "--set-upstream-to=origin/main", "feature");
  const before = repositoryState(repository.root, repository.repository);
  const commands = [];
  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    }),
  );
  assert.equal(report.observation.state, "idea-created");
  assert.deepEqual(repositoryState(repository.root, repository.repository), before);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.equal(git(repository.root, "branch", "--show-current"), "feature");
});

test("[create-primary-upstream] rejects missing or incorrect upstream on a topic branch", async () => {
  for (const mismatch of ["missing", "branch", "repository"]) {
    const repository = await fixture();
    git(repository.root, "checkout", "-b", "feature", "--no-track");
    if (mismatch === "branch") {
      git(repository.root, "branch", "other");
      git(repository.root, "push", "origin", "other");
      git(repository.root, "branch", "--set-upstream-to=origin/other", "feature");
    } else if (mismatch === "repository") {
      git(repository.root, "branch", "--set-upstream-to=origin/main", "feature");
      git(repository.root, "remote", "set-url", "origin", join(repository.base, "wrong.git"));
    }
    const before = git(repository.root, "status", "--porcelain=v1", "--untracked-files=all");
    const report = await createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(report.observation.state, "repository-preparation-required", mismatch);
    assert.deepEqual(
      report.observation.problems.map(({ type }) => type),
      ["primary-upstream-mismatch"],
      mismatch,
    );
    assert.equal(git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"), before);
    assert.deepEqual(await readdir(join(repository.root, ".silvermoon", "ideas")), [FIRST_ID]);
  }
});

test("rejects detached HEAD and dirty topic branches without creating a scaffold", async () => {
  for (const condition of ["detached", "untracked", "unstaged", "staged"]) {
    const repository = await fixture();
    git(repository.root, "checkout", "-b", "feature");
    git(repository.root, "branch", "--set-upstream-to=origin/main", "feature");
    if (condition === "detached") {
      git(repository.root, "checkout", "--detach", "HEAD");
    } else if (condition === "untracked") {
      await writeFile(join(repository.root, "unknown.txt"), "preserve\n");
    } else {
      const trackedPath = ideaPaths(FIRST_ID).ideaDocumentPath;
      await writeFile(join(repository.root, trackedPath), "# Changed fixture\n");
      if (condition === "staged") git(repository.root, "add", trackedPath);
    }
    const before = git(repository.root, "status", "--porcelain=v1", "--untracked-files=all");
    const report = await createIdea({
      generateId: () => createdId,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(report.observation.state, "repository-preparation-required", condition);
    assert.deepEqual(
      report.observation.problems.map(({ type }) => type),
      [condition === "detached" ? "detached-head" : "worktree-changes"],
      condition,
    );
    assert.equal(git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"), before);
    assert.deepEqual(await readdir(join(repository.root, ".silvermoon", "ideas")), [FIRST_ID]);
  }
});

test("[partial-write-failure] cleans up operation-owned partial files", async () => {
  const repository = await fixture();
  let writes = 0;
  const operations = {
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 3) {
        const error = new Error("injected write failure");
        error.code = "EIO";
        throw error;
      }
      return writeFile(...args);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(
    report.actions.map(({ type, status }) => [type, status]),
    [
      ["create-idea-scaffold", "failure"],
      ["remove-owned-creation-paths", "success"],
    ],
  );
  assert.equal(report.observation.state, "idea-create-failed");
  assert.equal(Object.hasOwn(report.observation, "createdIdea"), false);
  assert.match(report.actions[0].problem.summary, /injected write failure/);
  assert.equal(report.actions[1].result.preserved, 0);
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(createdId).ideaDocumentPath.split("/")),
    ),
    { code: "ENOENT" },
  );
  assert.equal(
    git(repository.root, "status", "--porcelain=v1", "--untracked-files=all"),
    "",
  );
});

test("preserves a concurrently modified created file and reports incomplete cleanup", async () => {
  const repository = await fixture();
  const paths = ideaPaths(createdId);
  const ideaDocument = join(
    repository.root,
    ...paths.ideaDocumentPath.split("/"),
  );
  let writes = 0;
  const operations = {
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 2) {
        await writeFile(ideaDocument, IDEA_TEMPLATE.slice(0, 12));
        const error = new Error("injected concurrent failure");
        error.code = "EIO";
        throw error;
      }
      return writeFile(...args);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.ok(report.actions[1].result.preserved > 0);
  assert.match(report.response.problems[0].summary, /Preserved [1-9]\d* path/);
  assert.equal(await readFile(ideaDocument, "utf8"), IDEA_TEMPLATE.slice(0, 12));
});

test("returns an envelope when candidate inspection fails", async () => {
  const repository = await fixture();
  const operations = {
    lstat: async (path) => {
      if (path.endsWith(createdId)) {
        const error = new Error("injected access failure");
        error.code = "EACCES";
        throw error;
      }
      return lstat(path);
    },
  };

  const report = await createIdea({
    generateId: () => createdId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.match(report.actions[0].problem.summary, /injected access failure/);
});

test("does not retry after a concurrent file collision leaves another writer's path", async () => {
  const repository = await fixture();
  const paths = ideaPaths(createdId);
  let writes = 0;
  const operations = {
    writeFile: async (path, source, options) => {
      writes += 1;
      if (writes === 2) {
        await writeFile(path, "concurrent\n", { flag: "wx" });
        return writeFile(path, source, options);
      }
      return writeFile(path, source, options);
    },
  };

  const report = await createIdea({
    generateId: () => writes < 3 ? createdId : secondId,
    operations,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.ok(report.actions[1].result.preserved > 0);
  assert.match(report.response.problems[0].summary, /Preserved [1-9]\d* path/);
  assert.equal(
    await readFile(
      join(repository.root, ...paths.implementationDocumentPath.split("/")),
      "utf8",
    ),
    "concurrent\n",
  );
  await assert.rejects(
    readFile(
      join(repository.root, ...ideaPaths(secondId).statusPath.split("/")),
    ),
    { code: "ENOENT" },
  );
});

test("returns a failure outcome for an invalid generated identity", async () => {
  const repository = await fixture();
  const before = spawnSync(
    "git",
    ["-C", repository.root, "status", "--porcelain=v1"],
    { encoding: "utf8", windowsHide: true },
  ).stdout;

  const report = await createIdea({
    generateId: () => "invalid",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.actions[0].status, "failure");
  assert.equal(report.actions[1].status, "success");
  assert.match(report.actions[0].problem.summary, /canonical ULID/);
  assert.equal(
    spawnSync(
      "git",
      ["-C", repository.root, "status", "--porcelain=v1"],
      { encoding: "utf8", windowsHide: true },
    ).stdout,
    before,
  );
});

test("attaches preparing guidance before creating a scaffold", async () => {
  const repository = await fixture();
  const preparingPath = phaseGuidancePath("preparing");
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...preparingPath.split("/")),
    "Prepare this project-specific contract.\n",
  );
  await mkdir(
    join(repository.root, ...phaseGuidancePath("implementing").split("/")),
  );
  await writeFile(
    join(
      repository.root,
      ...phaseGuidancePath("implementing").split("/"),
      "invalid.md",
    ),
    "ignored\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add preparing guidance");

  const report = await createIdea({
    generateId: () => createdId,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-created");
  assert.deepEqual(report.observation.guidance, {
    phase: "preparing",
    path: preparingPath,
    contentRevision: git(repository.root, "rev-parse", `HEAD:${preparingPath}`),
  });
  assert.equal(
    report.response.guidance.content,
    "Prepare this project-specific contract.\n",
  );
  assert.match(responseText(report), /Ideal World/);
  assert.doesNotMatch(responseText(report), /project-specific contract/);
});

test("invalid preparing guidance stops before any scaffold write", async () => {
  const repository = await fixture();
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...phaseGuidancePath("preparing").split("/")),
    " \n\t\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add invalid preparing guidance");
  const ideasBefore = await readdir(join(repository.root, ".silvermoon", "ideas"));
  let directoryWrites = 0;

  const report = await createIdea({
    generateId: () => createdId,
    operations: {
      mkdir: async (...args) => {
        directoryWrites += 1;
        return mkdir(...args);
      },
    },
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "phase-guidance-invalid");
  assert.deepEqual(
    report.observation.problems.map(({ type }) => type),
    ["guidance-file-empty"],
  );
  assert.equal(report.actions.length, 0);
  assert.equal(directoryWrites, 0);
  assert.deepEqual(
    await readdir(join(repository.root, ".silvermoon", "ideas")),
    ideasBefore,
  );
  assert.doesNotMatch(responseText(report), /Ideal World/);
  assert.match(responseText(report), /preparing\.md/);
});

test("does not inspect preparing guidance before creation preflight succeeds", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "dirty.txt"), "preserve\n");
  let reads = 0;

  const report = await createIdea({
    generateId: () => createdId,
    guidanceReader: async () => {
      reads += 1;
      throw new Error("guidance must not be read");
    },
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-preparation-required");
  assert.equal(reads, 0);
});
