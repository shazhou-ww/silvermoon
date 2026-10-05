import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { configDiagnostic, parseConfigSource } from "./rules.js";
export { serializeConfig, validPrimaryBranch } from "./rules.js";

import { inspectTreeLineage, readGitBlobs } from "../git/index.js";
import { CONFIG_PATH, METADATA_ROOT } from "../coordinates/index.js";

export const DEFAULT_CONFIG_NAME = CONFIG_PATH;

const DEFAULT_FILESYSTEM = { lstat, readFile };

async function regularRepositoryFile(root, filesystem) {
  const metadataRoot = resolve(root, METADATA_ROOT);
  const absolutePath = resolve(root, CONFIG_PATH);
  try {
    try {
      await filesystem.lstat(resolve(root, ".silvermoon/transaction"));
      throw Object.assign(new Error("Unfinished state transaction; preserve its plan, maintain exact event bytes directly, or use the explicit migration recovery entrypoint."), { code: "EBUSY" });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const directoryMetadata = await filesystem.lstat(metadataRoot);
    if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
      throw Object.assign(new Error(`${METADATA_ROOT} must be a regular directory`), {
        code: "EINVAL",
      });
    }
    const fileMetadata = await filesystem.lstat(absolutePath);
    if (!fileMetadata.isFile() || fileMetadata.isSymbolicLink()) {
      throw Object.assign(new Error("Configuration must be a regular file"), {
        code: "EINVAL",
      });
    }
    return {
      absolutePath,
      source: await filesystem.readFile(absolutePath, "utf8"),
    };
  } catch (error) {
    const missing = error.code === "ENOENT";
    return {
      absolutePath,
      diagnostic: configDiagnostic(
        missing ? "config.missing" : "config.invalid-file",
        CONFIG_PATH,
        missing
          ? `Missing Silvermoon configuration: ${CONFIG_PATH}`
          : `Cannot read Silvermoon configuration: ${error.message}`,
        missing
          ? `Create ${CONFIG_PATH}.`
          : `Replace ${METADATA_ROOT} and ${CONFIG_PATH} with repository-owned regular paths.`,
      ),
    };
  }
}

export async function loadConfig({
  filesystem = DEFAULT_FILESYSTEM,
  root,
}) {
  const loaded = await regularRepositoryFile(root, filesystem);
  if (loaded.diagnostic) {
    return {
      config: null,
      configPath: loaded.absolutePath,
      diagnostics: [loaded.diagnostic],
    };
  }
  return parseConfigSource({
    absolutePath: loaded.absolutePath,
    root,
    source: loaded.source,
  });
}

export async function loadConfigSnapshot({ gitRoot, tree }) {
  const absolutePath = resolve(gitRoot, CONFIG_PATH);
  const entries = inspectTreeLineage(gitRoot, tree, CONFIG_PATH);
  const metadataRoot = entries.find(({ name }) => name === METADATA_ROOT);
  const config = entries.find(({ name }) => name === CONFIG_PATH);
  if (metadataRoot === undefined || config === undefined) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [configDiagnostic(
        "config.missing",
        CONFIG_PATH,
        `Missing Silvermoon configuration: ${CONFIG_PATH}`,
        `Create ${CONFIG_PATH}.`,
      )],
    };
  }
  if (
    metadataRoot.type !== "tree"
    || metadataRoot.mode !== "040000"
    || config.type !== "blob"
    || !["100644", "100755"].includes(config.mode)
  ) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [configDiagnostic(
        "config.invalid-file",
        CONFIG_PATH,
        "Cannot read Silvermoon configuration: configuration paths must be regular",
        `Replace ${METADATA_ROOT} and ${CONFIG_PATH} with repository-owned regular paths.`,
      )],
    };
  }
  const source = readGitBlobs(gitRoot, [config.object]).get(config.object);
  if (source === undefined) {
    throw new Error(`Cannot read Silvermoon configuration blob ${config.object}`);
  }
  return parseConfigSource({
    absolutePath,
    root: gitRoot,
    source: source.toString("utf8"),
  });
}
