import { inspectIdeaLayout } from "./idea-layout.ts";
import { isValidUlid } from "../../foundation/idea-model/index.ts";
import type { BusinessFileSystem, EventStore, ProjectConfig } from "./business-types.ts";

export async function resolveIdea(
  root: string,
  tree: string,
  config: ProjectConfig,
  selector: string,
  options: {
    projectedEvents?: boolean;
    filesystem?: BusinessFileSystem;
    eventOverrides?: Map<string, EventStore>;
  } = {},
): Promise<string> {
  if (isValidUlid(selector)) return selector;
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree, ...options });
  if (layout.diagnostics.length) throw new Error("Use the exact idea ULID while repairing an invalid layout.");
  const idea = layout.ideas.find(({ alias }) => alias === selector);
  if (!idea) throw new Error(`Unknown idea selector: ${selector}`);
  return idea.id;
}
