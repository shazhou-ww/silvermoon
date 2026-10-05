import { inspectIdeaLayout } from "./idea-layout.js";

export async function observeIdea({
  config,
  filesystem,
  gitRoot,
  project,
  root,
  snapshotTree,
} = {}) {
  const layout = await inspectIdeaLayout({
    config,
    filesystem,
    gitRoot,
    root,
    snapshotTree,
  });
  return { ...layout, project };
}
