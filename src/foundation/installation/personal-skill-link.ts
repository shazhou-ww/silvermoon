import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

function samePath(left: string, right: string) {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function regularFiles(root: string, directory = root): Promise<string[] | null> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await regularFiles(root, path);
      if (nested === null) return null;
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(relative(root, path));
    } else {
      return null;
    }
  }
  return files.sort();
}

async function directoriesMatch(left: string, right: string) {
  const [leftFiles, rightFiles] = await Promise.all([
    regularFiles(left),
    regularFiles(right),
  ]);
  if (leftFiles === null || rightFiles === null) return false;
  if (leftFiles.length !== rightFiles.length) return false;
  for (let index = 0; index < leftFiles.length; index += 1) {
    const path = leftFiles[index];
    if (path === undefined || path !== rightFiles[index]) return false;
    const [leftContent, rightContent] = await Promise.all([
      readFile(join(left, path)),
      readFile(join(right, path)),
    ]);
    if (!leftContent.equals(rightContent)) return false;
  }
  return true;
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
      && await directoriesMatch(source, destination)
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
