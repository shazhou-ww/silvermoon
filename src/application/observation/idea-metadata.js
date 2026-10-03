import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extractIdeaTitle, ideaInventoryItem } from "../../idea/index.js";
import { localize } from "../../project/rules/index.js";

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

export function metadataFailureObservation(observed, caught, command) {
  const { ideas: _ideas, ...base } = observed.observation;
  const problem = {
    type: "idea-metadata-unavailable",
    summary: localize(
      observed.outputLanguage,
      caught.message,
      `无法读取 idea metadata：${caught.message}`,
    ),
  };
  return {
    observation: {
      ...base,
      state: "project-setup-required",
      observedThrough: "configuration",
      problems: [problem],
    },
    responseContext: {
      nextSteps: localize(
        observed.outputLanguage,
        `Repair the reported idea document and retry \`${command}\`.`,
        `修复报告的 idea document 后，重新运行 \`${command}\`。`,
      ),
    },
  };
}
