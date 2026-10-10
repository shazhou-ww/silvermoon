import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extractIdeaTitle, ideaInventoryItem } from "../../foundation/idea-query/index.ts";

interface InventoryIdea {
  id: string;
  alias?: string;
  state: string;
  worlds: { idealRevision: { documentPath: string } };
}

export class IdeaMetadataReadError extends Error {
  readonly documentPath: string;

  constructor(id: string, documentPath: string, cause: unknown) {
    super(
      `Cannot read idea metadata for ${id} at ${documentPath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
    this.name = "IdeaMetadataReadError";
    this.documentPath = documentPath;
  }
}

export async function readIdeaInventoryItem(root: string, idea: InventoryIdea) {
  const documentPath = idea.worlds.idealRevision.documentPath;
  try {
    const source = await readFile(
      resolve(root, ...documentPath.split("/")),
      "utf8",
    );
    return ideaInventoryItem(
      {
        id: idea.id,
        state: idea.state,
        ...(idea.alias === undefined ? {} : { alias: idea.alias }),
      },
      extractIdeaTitle(source),
    );
  } catch (caught) {
    throw new IdeaMetadataReadError(idea.id, documentPath, caught);
  }
}
