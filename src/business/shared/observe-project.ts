import { inspectAdoption } from "../../foundation/skill-registration/index.ts";
import type { BusinessFileSystem } from "./business-types.ts";

export async function observeProject({
  contentRoot,
  device,
  filesystem,
  gitRoot,
  root,
}: {
  contentRoot?: string | undefined;
  device?: unknown;
  filesystem?: BusinessFileSystem | undefined;
  gitRoot?: string | undefined;
  root?: string | undefined;
} = {}) {
  const adoption = await inspectAdoption({
    ...(contentRoot === undefined ? {} : { contentRoot }),
    ...(filesystem === undefined ? {} : { filesystem }),
    ...(gitRoot === undefined ? {} : { repositoryRoot: gitRoot }),
    ...(root === undefined ? {} : { root }),
  });
  return { ...adoption, device };
}
