import { inspectIdeaLayout } from "./idea-layout.ts";
import type { BusinessFileSystem, ProjectConfig } from "./business-types.ts";

export async function observeIdea({
  config,
  filesystem,
  gitRoot,
  project,
  root,
  snapshotTree,
}: {
  config?: ProjectConfig;
  filesystem?: BusinessFileSystem | undefined;
  gitRoot?: string | undefined;
  project?: unknown;
  root?: string | undefined;
  snapshotTree?: string | undefined;
} = {}) {
  if (!config || !root) throw new TypeError("Idea observation requires config and root.");
  const layout = await inspectIdeaLayout({
    config,
    filesystem,
    gitRoot,
    root,
    snapshotTree,
  });
  return { ...layout, project };
}
