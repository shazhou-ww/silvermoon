import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { afterEach as nodeAfterEach } from "node:test";

import { createRepository, git, type RepositoryFixtureOptions } from "./repository.ts";

type RepositoryFixture = Awaited<ReturnType<typeof createRepository>>;
type ResponseReport = {
  response: { nextSteps?: Array<{ text: string }> };
};

export function createCreateIdeaTestHelpers(afterEach: typeof nodeAfterEach) {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      ),
    );
  });

  async function fixture(options: RepositoryFixtureOptions = {}) {
    const repository = await createRepository({
      prefix: "silvermoon-create-",
      schemaVersion: 2,
      ...options,
    });
    temporaryDirectories.push(repository.base);
    return repository;
  }

  function repositoryState(root: string, repository: string) {
    return {
      head: git(root, "rev-parse", "HEAD"),
      index: git(root, "write-tree"),
      localRefs: git(root, "for-each-ref", "--format=%(refname) %(objectname)"),
      remoteRefs: git(root, "ls-remote", repository),
    };
  }

  function responseText(report: ResponseReport) {
    return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
  }

  async function pushPeerChange(repository: RepositoryFixture) {
    if (repository.remote === null) {
      throw new Error("Peer-change fixture requires a remote repository");
    }
    const peer = join(repository.base, "peer");
    const cloned = spawnSync("git", ["clone", repository.remote, peer], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(cloned.status, 0, cloned.stderr);
    git(peer, "config", "user.name", "silvermoon peer");
    git(peer, "config", "user.email", "silvermoon@example.invalid");
    await writeFile(join(peer, "peer.txt"), "peer\n");
    git(peer, "add", ".");
    git(peer, "commit", "-m", "Move primary concurrently");
    git(peer, "push", "origin", "main");
  }

  return {
    fixture,
    pushPeerChange,
    repositoryState,
    responseText,
  };
}
