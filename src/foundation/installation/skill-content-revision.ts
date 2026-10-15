import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

async function regularFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await regularFiles(root, path));
    } else if (entry.isFile()) {
      files.push(relative(root, path).split(sep).join("/"));
    } else {
      throw new TypeError(`Skill content contains a non-file entry at ${path}.`);
    }
  }
  return files.sort();
}

function addFramed(hash: ReturnType<typeof createHash>, value: Buffer) {
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(value.length));
  hash.update(length);
  hash.update(value);
}

export async function directoryContentRevision(root: string) {
  const files = await regularFiles(root);
  const hash = createHash("sha256");
  for (const path of files) {
    addFramed(hash, Buffer.from(path, "utf8"));
    addFramed(hash, await readFile(join(root, ...path.split("/"))));
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function directoriesMatch(left: string, right: string) {
  const [leftRevision, rightRevision] = await Promise.all([
    directoryContentRevision(left),
    directoryContentRevision(right),
  ]);
  return leftRevision === rightRevision;
}
