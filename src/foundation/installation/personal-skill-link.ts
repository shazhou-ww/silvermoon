import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { directoriesMatch } from "./skill-content-revision.ts";

function samePath(left: string, right: string) {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

export async function linkPersonalSkill({
  home = homedir(),
  skillRoot,
}: {
  home?: string;
  skillRoot: string;
}) {
  const source = await realpath(skillRoot);
  await readFile(join(source, "SKILL.md"), "utf8");
  const destination = resolve(home, ".agents", "skills", "silvermoon");
  await mkdir(dirname(destination), { recursive: true });

  let replacement: "copy" | "link" | null = null;
  try {
    const metadata = await lstat(destination);
    let target: string | null = null;
    try {
      target = await realpath(destination);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    if (target !== null && samePath(target, source)) {
      return { destination, source, status: "already-linked" as const };
    }
    if (metadata.isSymbolicLink()) {
      await rm(destination);
      replacement = "link";
    } else if (
      metadata.isDirectory()
      && await directoriesMatch(source, destination).catch(() => false)
    ) {
      await rm(destination, { recursive: true });
      replacement = "copy";
    } else {
      throw new Error(
        `${destination} already exists and is not an unmodified copy of ${source}; preserve or remove it before linking the installation.`,
      );
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  await symlink(
    source,
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linkedTarget = await realpath(destination);
  if (!samePath(linkedTarget, source)) {
    throw new Error(
      `Created ${destination}, but it resolves to ${linkedTarget} instead of ${source}.`,
    );
  }
  return {
    destination,
    source,
    status: replacement === "copy"
      ? "replaced-copy" as const
      : replacement === "link"
      ? "relinked" as const
      : "created" as const,
  };
}
