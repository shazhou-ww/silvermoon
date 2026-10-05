import { access, readFile } from "node:fs/promises";
import { delimiter, dirname, extname, join, resolve } from "node:path";

async function firstExecutable(paths, names, filesystem) {
  for (const directory of paths) {
    for (const name of names) {
      const candidate = join(directory, name);
      try {
        await filesystem.access(candidate);
        return resolve(candidate);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "EACCES") throw error;
      }
    }
  }
  return null;
}

export function classifyRuntimeSource(entryPath, globalExecutable) {
  const entry = resolve(entryPath ?? "").replaceAll("\\", "/").toLowerCase();
  const global = globalExecutable?.replaceAll("\\", "/").toLowerCase();
  if (global && entry === global) return "global";
  if (entry.includes("/node_modules/silvermoon/")) return "other";
  return "source-checkout";
}

export async function inspectInstallation({
  entryPath = process.argv[1],
  env = process.env,
  platform = process.platform,
  filesystem = { access, readFile },
} = {}) {
  const paths = (env.PATH ?? "").split(delimiter).filter(Boolean);
  const names = platform === "win32"
    ? ["silvermoon.cmd", "silvermoon.exe", "silvermoon"]
    : ["silvermoon"];
  const executable = await firstExecutable(paths, names, filesystem);
  let version = null;
  if (executable && extname(executable) === ".js") {
    try {
      const manifest = JSON.parse(
        await filesystem.readFile(resolve(dirname(executable), "..", "package.json"), "utf8"),
      );
      version = typeof manifest.version === "string" ? manifest.version : null;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return {
    source: classifyRuntimeSource(entryPath, executable),
    executable,
    version,
    globalInstallationPresent: executable !== null,
  };
}
