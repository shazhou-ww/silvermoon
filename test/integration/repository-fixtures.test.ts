import assert from "node:assert/strict";
import { access, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  createRepository,
  git,
  PRIMARY_REPOSITORY,
} from "../helpers/repository.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

test("creates independent V1 and V2 repositories from immutable seeds", async () => {
  const repositories = await Promise.all(
    ([1, 2] as const).map(async (schemaVersion) => {
      const [first, second] = await Promise.all([
        createRepository({ schemaVersion }),
        createRepository({ schemaVersion }),
      ]);
      return { first, schemaVersion, second };
    }),
  );

  for (const { first, schemaVersion, second } of repositories) {
    temporaryDirectories.push(first.base, second.base);

    assert.equal(
      git(first.root, "config", "--get", "remote.origin.url"),
      PRIMARY_REPOSITORY,
    );
    assert.equal(
      git(first.root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"),
      "origin/main",
    );
    assert.notEqual(first.remote, second.remote);
    const firstBase = git(first.root, "ls-remote", "origin", "refs/heads/main")
      .split("\t")[0];
    const secondBase = git(second.root, "ls-remote", "origin", "refs/heads/main")
      .split("\t")[0];
    assert.equal(firstBase, secondBase);

    await writeFile(
      join(first.root, `only-first-v${schemaVersion}.txt`),
      "isolated update\n",
    );
    git(first.root, "add", ".");
    git(first.root, "commit", "-m", `Update first V${schemaVersion} fixture`);
    git(first.root, "push", "origin", "main");

    assert.notEqual(
      git(first.root, "ls-remote", "origin", "refs/heads/main").split("\t")[0],
      firstBase,
    );
    assert.equal(
      git(second.root, "ls-remote", "origin", "refs/heads/main").split("\t")[0],
      secondBase,
    );
    assert.equal(git(second.root, "rev-parse", "HEAD"), secondBase);
  }
});

test("creates a local-only fixture without a remote or bare primary", async () => {
  const repository = await createRepository({ withRemote: false });
  temporaryDirectories.push(repository.base);

  assert.equal(repository.remote, null);
  assert.equal(repository.repository, null);
  assert.equal(git(repository.root, "remote"), "");
  assert.equal(git(repository.root, "branch", "--show-current"), "main");
  await assert.rejects(access(join(repository.base, "primary.git")), {
    code: "ENOENT",
  });
});
