import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { afterEach as nodeAfterEach } from "node:test";

import {
  createRepository,
  git,
  PRIMARY_REPOSITORY,
  type RepositoryFixtureOptions,
} from "./repository.ts";

type RepositoryFixture = Awaited<ReturnType<typeof createRepository>>;
type ResponseReport = {
  response: { nextSteps?: Array<{ text: string }> };
};

export function createWhatsNextTestHelpers(afterEach: typeof nodeAfterEach) {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      ),
    );
  });

  async function fixture(options: RepositoryFixtureOptions = {}) {
    const repository = await createRepository(options);
    temporaryDirectories.push(repository.base);
    return repository;
  }

  function trackTemporaryDirectory(directory: string) {
    temporaryDirectories.push(directory);
  }

  function envelopeKeys(report: object) {
    return Object.keys(report).sort();
  }

  function responseText(report: ResponseReport) {
    return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
  }

  async function pushPeerChange(repository: RepositoryFixture, name: string) {
    if (repository.remote === null) {
      throw new Error("Peer-change fixture requires a remote repository");
    }
    const peer = join(repository.base, `peer-${name}`);
    const cloned = spawnSync("git", ["clone", repository.remote, peer], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(cloned.status, 0, cloned.stderr);
    git(peer, "config", "user.name", "silvermoon peer");
    git(peer, "config", "user.email", "silvermoon@example.invalid");
    await writeFile(join(peer, `${name}.txt`), `${name}\n`);
    git(peer, "add", ".");
    git(peer, "commit", "-m", `Add ${name}`);
    git(peer, "push", "origin", "main");
  }

  return {
    envelopeKeys,
    fixture,
    pushPeerChange,
    responseText,
    trackTemporaryDirectory,
  };
}
