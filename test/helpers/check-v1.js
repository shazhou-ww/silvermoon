import { rm } from "node:fs/promises";

import { createRepository } from "./repository.js";

export function createCheckV1TestHelpers(afterEach) {
  const temporaryDirectories = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      ),
    );
  });

  async function fixture({ withRemote = false } = {}) {
    const repository = await createRepository({
      prefix: "silvermoon-check-",
      withRemote,
    });
    temporaryDirectories.push(repository.base);
    return repository;
  }

  function trackTemporaryDirectory(directory) {
    temporaryDirectories.push(directory);
  }

  return { fixture, trackTemporaryDirectory };
}
