import { rm } from "node:fs/promises";
import type { afterEach as nodeAfterEach } from "node:test";

import { createRepository, type RepositoryFixtureOptions } from "./repository.ts";

export function createCheckV1TestHelpers(afterEach: typeof nodeAfterEach) {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      ),
    );
  });

  async function fixture({
    objectFormat,
    withRemote = false,
  }: Pick<RepositoryFixtureOptions, "objectFormat" | "withRemote"> = {}) {
    const repository = await createRepository({
      prefix: "silvermoon-check-",
      withRemote,
      ...(objectFormat === undefined ? {} : { objectFormat }),
    });
    temporaryDirectories.push(repository.base);
    return repository;
  }

  function trackTemporaryDirectory(directory: string) {
    temporaryDirectories.push(directory);
  }

  return { fixture, trackTemporaryDirectory };
}
