import { access, readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface InstallationFileSystem {
  access: typeof access;
  readFile: typeof readFile;
  realpath: typeof realpath;
}

interface InspectInstallationOptions {
  entryPath?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  filesystem?: InstallationFileSystem;
}

export type RuntimeSource = "global" | "host" | "source-checkout";

const packageRoot = fileURLToPath(new URL(
  import.meta.url.endsWith(".ts") ? "../../.." : "../../../..",
  import.meta.url,
));
const packageManifest = resolve(packageRoot, "package.json");
const packageEntry = resolve(
  packageRoot,
  import.meta.url.endsWith(".ts")
    ? "bin/silvermoon.ts"
    : "dist/bin/silvermoon.js",
);

function errorCode(caught: unknown) {
  return caught instanceof Error && "code" in caught && typeof caught.code === "string"
    ? caught.code
    : undefined;
}

async function firstExecutable(
  paths: string[],
  names: string[],
  filesystem: Pick<InstallationFileSystem, "access">,
) {
  for (const directory of paths) {
    for (const name of names) {
      const candidate = join(directory, name);
      try {
        await filesystem.access(candidate);
        return resolve(candidate);
      } catch (error) {
        const code = errorCode(error);
        if (code !== "ENOENT" && code !== "EACCES") throw error;
      }
    }
  }
  return null;
}

export function classifyRuntimeSource(
  entryPath: string | undefined,
  globalExecutable: string | null,
  executable?: string | null,
): RuntimeSource {
  const entry = resolve(entryPath ?? "").replaceAll("\\", "/").toLowerCase();
  const global = globalExecutable?.replaceAll("\\", "/").toLowerCase();
  const command = executable?.replaceAll("\\", "/").toLowerCase();
  if (command?.includes("/node_modules/.bin/")) return "host";
  if (global && entry === global) return "global";
  if (entry.includes("/node_modules/silvermoon/")) return "host";
  return "source-checkout";
}

async function resolvedPath(
  path: string,
  filesystem: Pick<InstallationFileSystem, "realpath">,
) {
  try {
    return await filesystem.realpath(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT" || errorCode(error) === "EACCES") {
      return resolve(path);
    }
    throw error;
  }
}

async function globalRuntimeEntry(
  executable: string | null,
  platform: NodeJS.Platform,
  filesystem: Pick<InstallationFileSystem, "access" | "readFile" | "realpath">,
) {
  if (!executable) return null;
  const physicalExecutable = await resolvedPath(executable, filesystem);
  if (platform !== "win32" || extname(physicalExecutable) === ".js") {
    return physicalExecutable;
  }
  const candidates: string[] = [];
  if (extname(executable).toLowerCase() === ".cmd") {
    try {
      const shim = await filesystem.readFile(executable, "utf8");
      for (const match of shim.matchAll(/"([^"\r\n]*silvermoon\.js)"/gi)) {
        const target = match[1];
        if (target === undefined) continue;
        candidates.push(resolve(
          target.replace(/%~?dp0%?/gi, `${dirname(executable)}\\`),
        ));
      }
    } catch (error) {
      const code = errorCode(error);
      if (code !== "ENOENT" && code !== "EACCES") throw error;
    }
  }
  candidates.push(resolve(
    dirname(executable),
    "node_modules",
    "silvermoon",
    "dist",
    "bin",
    "silvermoon.js",
  ));
  for (const candidate of candidates) {
    try {
      await filesystem.access(candidate);
      return resolvedPath(candidate, filesystem);
    } catch (error) {
      const code = errorCode(error);
      if (code !== "ENOENT" && code !== "EACCES") throw error;
    }
  }
  return physicalExecutable;
}

export async function inspectInstallation({
  entryPath,
  env = process.env,
  platform = process.platform,
  filesystem = { access, readFile, realpath },
}: InspectInstallationOptions = {}) {
  const runningEntry = entryPath ?? packageEntry;
  const paths = (env.PATH ?? "").split(delimiter).filter(Boolean);
  const names = platform === "win32"
    ? ["silvermoon.cmd", "silvermoon.exe", "silvermoon"]
    : ["silvermoon"];
  const executable = await firstExecutable(paths, names, filesystem);
  const [entry, globalEntry] = await Promise.all([
    resolvedPath(runningEntry, filesystem),
    globalRuntimeEntry(executable, platform, filesystem),
  ]);
  let version = null;
  let versionError: string | undefined;
  try {
    const manifest: unknown = JSON.parse(
      await filesystem.readFile(packageManifest, "utf8"),
    );
    version = manifest !== null && typeof manifest === "object"
        && "version" in manifest && typeof manifest.version === "string"
      ? manifest.version
      : null;
  } catch (error) {
    versionError = error instanceof Error ? error.message : String(error);
  }
  return {
    source: entryPath === undefined
      ? "source-checkout" as const
      : classifyRuntimeSource(entry, globalEntry, executable),
    entry,
    executable,
    packageRoot,
    version,
    ...(versionError === undefined ? {} : { versionError }),
    globalInstallationPresent: executable !== null,
  };
}
