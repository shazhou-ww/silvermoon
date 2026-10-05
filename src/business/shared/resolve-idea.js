import { inspectIdeaLayout } from "./idea-layout.js";
import { isValidUlid } from "../../foundation/idea-model/index.js";

export async function resolveIdea(root, tree, config, selector, options = {}) {
  if (isValidUlid(selector)) return selector;
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree, ...options });
  if (layout.diagnostics.length) throw new Error("Use the exact idea ULID while repairing an invalid layout.");
  const idea = layout.ideas.find(({ alias }) => alias === selector);
  if (!idea) throw new Error(`Unknown idea selector: ${selector}`);
  return idea.id;
}
