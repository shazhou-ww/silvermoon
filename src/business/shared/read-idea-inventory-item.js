import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extractIdeaTitle, ideaInventoryItem } from "../../foundation/idea-query/index.js";

export async function readIdeaInventoryItem(root, idea) {
  const documentPath = idea.worlds.idealRevision.documentPath;
  try {
    const source = await readFile(
      resolve(root, ...documentPath.split("/")),
      "utf8",
    );
    return ideaInventoryItem(idea, extractIdeaTitle(source));
  } catch (caught) {
    throw new Error(
      `Cannot read idea metadata for ${idea.id} at ${documentPath}: ${caught.message}`,
      { cause: caught },
    );
  }
}
