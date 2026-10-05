import { inspectAdoption } from "../../foundation/skill-registration/index.js";

export async function observeProject({
  contentRoot,
  device,
  filesystem,
  gitRoot,
  root,
} = {}) {
  const adoption = await inspectAdoption({
    contentRoot,
    filesystem,
    repositoryRoot: gitRoot,
    root,
  });
  return { ...adoption, device };
}
