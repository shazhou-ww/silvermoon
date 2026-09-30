import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createRepository,
  git,
  PRIMARY_REPOSITORY,
} from "./repository.js";

export function createWhatsNextTestHelpers(afterEach) {
  const temporaryDirectories = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      ),
    );
  });

  async function fixture(options) {
    const repository = await createRepository(options);
    temporaryDirectories.push(repository.base);
    return repository;
  }

  function trackTemporaryDirectory(directory) {
    temporaryDirectories.push(directory);
  }

  function envelopeKeys(report) {
    return Object.keys(report).sort();
  }

  function responseText(report) {
    return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
  }

  async function pushPeerChange(repository, name) {
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
