import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createEnvelope,
  dialogueReadyObservation,
  localize,
  outcome,
} from "./dialogue.js";
import {
  DEPLOYMENT_TEMPLATE,
  IDEA_TEMPLATE,
  IMPLEMENTATION_TEMPLATE,
  LEDGER_TEMPLATE,
} from "./idea-templates.js";
import { isValidUlid, serializeIdeaStatus } from "./ideas.js";
import { canonicalizeLanguageTag } from "./language.js";
import { IDEAS_ROOT, ideaPaths } from "./layout.js";
import { observeSnapshot } from "./observation.js";
import {
  assessIdeaCreationReadiness,
  projectInstructions,
} from "./whatsnext.js";

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_ID_ATTEMPTS = 32;

function encode(value, length) {
  let encoded = "";
  for (let index = 0; index < length; index += 1) {
    encoded = ULID_ALPHABET[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

export function generateUlid({ now = Date.now(), random = randomBytes(10) } = {}) {
  return encode(BigInt(now), 10) + encode(BigInt(`0x${Buffer.from(random).toString("hex")}`), 16);
}

async function pathExists(path, inspect) {
  try {
    await inspect(path);
    return true;
  } catch (caught) {
    if (caught.code === "ENOENT") return false;
    throw caught;
  }
}

async function removeOwnedFile(path, expected, read, remove) {
  let current;
  try {
    current = await read(path);
  } catch (caught) {
    if (caught.code === "ENOENT") return { path, status: "missing" };
    throw caught;
  }
  const expectedBytes = Buffer.from(expected);
  if (current.equals(expectedBytes)) {
    await remove(path, { force: true });
    return { path, status: "removed" };
  }
  return { path, status: "preserved-modified" };
}

async function removeCreatedDirectories(created, removeDirectory) {
  const results = [];
  for (const path of [...created].reverse()) {
    try {
      await removeDirectory(path);
      results.push({ path, status: "removed" });
    } catch (caught) {
      results.push({ path, status: "preserved", error: caught.message });
    }
  }
  return results;
}

async function ensureDirectoryPath(root, relativePath, operations) {
  const created = [];
  let current = root;
  try {
    for (const segment of relativePath.split("/")) {
      current = resolve(current, segment);
      let metadata;
      try {
        metadata = await operations.inspect(current);
      } catch (caught) {
        if (caught.code !== "ENOENT") throw caught;
      }
      if (metadata) {
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw new Error(`Silvermoon path segment is not a regular directory: ${current}`);
        }
        continue;
      }
      try {
        await operations.makeDirectory(current);
        created.push(current);
      } catch (caught) {
        if (caught.code !== "EEXIST") throw caught;
        metadata = await operations.inspect(current);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw caught;
      }
    }
    return created;
  } catch (caught) {
    caught.cleanup = await removeCreatedDirectories(
      created,
      operations.removeDirectory,
    );
    throw caught;
  }
}

function cleanupSummary(results) {
  const preserved = results.filter(({ status }) => status.startsWith("preserved"));
  return preserved.length === 0
    ? "All paths still owned by this operation were removed."
    : `Preserved ${preserved.length} path(s) because they changed or could not be removed: `
      + preserved.map(({ path }) => path).join(", ");
}

function failureEnvelope({
  caught,
  intention,
  observation,
  outcomes,
  cleanup = [],
  language,
}) {
  outcomes.push(outcome(
    "create-idea-scaffold",
    "failure",
    localize(
      language,
      `Idea creation failed: ${caught.message} ${cleanupSummary(cleanup)}`,
      `创建 idea 失败：${caught.message} ${cleanupSummary(cleanup)}`,
    ),
  ));
  return createEnvelope(
    intention,
    dialogueReadyObservation(observation, "idea-create-failed"),
    outcomes,
    localize(
      language,
      "Preserve any reported paths, resolve the filesystem error, and retry `silvermoon create-idea`.",
      "保留报告中的路径，解决文件系统错误后，再运行 `silvermoon create-idea`。",
    ),
  );
}

function projectCreationObservation(observation) {
  const { ideas: _ideas, ...project } = observation;
  if (project.observedThrough === "ideas") {
    project.observedThrough = "configuration";
  }
  return project;
}

export async function createIdea({
  generateId = generateUlid,
  language,
  operations = {},
  root = process.cwd(),
  userHome,
} = {}) {
  const requestedRoot = resolve(root);
  const canonicalLanguage = language === undefined
    ? undefined
    : canonicalizeLanguageTag(language);
  const intention = {
    command: "create-idea",
    args: { language: canonicalLanguage ?? null },
  };
  const outcomes = [];
  const observed = await observeSnapshot({
    allowMissingIdeas: true,
    ideaLanguage: canonicalLanguage,
    root: requestedRoot,
    userHome,
    version: { type: "worktree" },
  });
  const recheckCommand = canonicalLanguage === undefined
    ? "silvermoon create-idea"
    : `silvermoon create-idea --language ${canonicalLanguage}`;
  if (!observed.projectReady) {
    return createEnvelope(
      intention,
      projectCreationObservation(observed.observation),
      outcomes,
      projectInstructions(
        observed,
        observed.observation.root,
        observed.language,
        recheckCommand,
      ),
    );
  }
  const repositoryRoot = observed.observation.root;
  const readiness = await assessIdeaCreationReadiness({
    observed,
    outcomes,
    recheckCommand,
    root: repositoryRoot,
  });
  if (!readiness.ready) {
    return createEnvelope(
      intention,
      dialogueReadyObservation(
        readiness.observation,
        "repository-preparation-required",
      ),
      outcomes,
      readiness.instructions,
    );
  }

  const inspect = operations.lstat ?? lstat;
  const makeDirectory = operations.mkdir ?? mkdir;
  const read = operations.readFile ?? readFile;
  const remove = operations.rm ?? rm;
  const removeDirectory = operations.rmdir ?? rmdir;
  const write = operations.writeFile ?? writeFile;
  const fileOperations = {
    inspect,
    makeDirectory,
    removeDirectory,
  };
  let rootDirectories;
  try {
    rootDirectories = await ensureDirectoryPath(
      repositoryRoot,
      IDEAS_ROOT,
      fileOperations,
    );
  } catch (caught) {
    return failureEnvelope({
      caught,
      intention,
      observation: readiness.observation,
      outcomes,
      cleanup: caught.cleanup,
      language: observed.language,
    });
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    let id;
    let paths;
    let folder;
    try {
      id = await generateId();
      if (!isValidUlid(id)) {
        throw new Error(`Generated idea id is not a canonical ULID: ${id}`);
      }
      paths = ideaPaths(id);
      folder = resolve(repositoryRoot, paths.ideaPath);
      if (await pathExists(folder, inspect)) continue;
    } catch (caught) {
      const cleanup = await removeCreatedDirectories(
        rootDirectories,
        removeDirectory,
      );
      return failureEnvelope({
        caught,
        intention,
        observation: readiness.observation,
        outcomes,
        cleanup,
        language: observed.language,
      });
    }

    const directoryPaths = [
      paths.ideaPath,
      paths.outerPath,
      paths.innerPath,
      paths.idealPath,
    ];
    const files = [
      [paths.ideaDocumentPath, IDEA_TEMPLATE],
      [paths.implementationDocumentPath, IMPLEMENTATION_TEMPLATE],
      [paths.deploymentDocumentPath, DEPLOYMENT_TEMPLATE],
      [paths.ledgerPath, LEDGER_TEMPLATE],
      [paths.statusPath, serializeIdeaStatus({
        version: 1,
        id,
        ...(canonicalLanguage === undefined ? {} : { language: canonicalLanguage }),
      })],
    ];
    const createdDirectories = [];
    const cleanupFiles = [];
    let collisionPath = null;
    try {
      for (const relativePath of directoryPaths) {
        const absolutePath = resolve(repositoryRoot, relativePath);
        await makeDirectory(absolutePath);
        createdDirectories.push(absolutePath);
      }
      for (const [relativePath, source] of files) {
        const absolutePath = resolve(repositoryRoot, relativePath);
        const cleanup = [absolutePath, source];
        cleanupFiles.push(cleanup);
        try {
          await write(absolutePath, source, { flag: "wx" });
        } catch (caught) {
          if (caught.code === "EEXIST") {
            cleanupFiles.pop();
            collisionPath = absolutePath;
          }
          throw caught;
        }
      }
      outcomes.push(outcome(
        "create-idea-scaffold",
        "success",
        localize(
          observed.language,
          `Created idea ${id} at ${paths.ideaPath}.`,
          `已在 ${paths.ideaPath} 创建 idea ${id}。`,
        ),
      ));
      return createEnvelope(
        intention,
        dialogueReadyObservation(readiness.observation, "idea-created", {
          createdIdea: { id, path: paths.ideaPath, state: "preparing" },
        }),
        outcomes,
        localize(
          observed.language,
          `Use ${observed.language} for natural-language content while describing the requested Ideal World in ${paths.ideaDocumentPath}; keep the stable IDs and placeholders in ${paths.implementationDocumentPath}, ${paths.deploymentDocumentPath}, and ${paths.ledgerPath} synchronized.`,
          `使用 ${observed.language} 在 ${paths.ideaDocumentPath} 中描述请求的理想契约，并保持 ${paths.implementationDocumentPath}、${paths.deploymentDocumentPath} 与 ${paths.ledgerPath} 中的稳定 ID 和占位同步。`,
        ),
      );
    } catch (caught) {
      const cleanup = [];
      for (const [path, source] of [...cleanupFiles].reverse()) {
        try {
          cleanup.push(await removeOwnedFile(path, source, read, remove));
        } catch (cleanupError) {
          cleanup.push({
            path,
            status: "preserved",
            error: cleanupError.message,
          });
        }
      }
      cleanup.push(...await removeCreatedDirectories(
        createdDirectories,
        removeDirectory,
      ));
      if (collisionPath) {
        cleanup.push({ path: collisionPath, status: "preserved-existing" });
      }
      cleanup.push(...await removeCreatedDirectories(
        rootDirectories,
        removeDirectory,
      ));
      return failureEnvelope({
        caught,
        intention,
        observation: readiness.observation,
        outcomes,
        cleanup,
        language: observed.language,
      });
    }
  }

  const cleanup = await removeCreatedDirectories(rootDirectories, removeDirectory);
  return failureEnvelope({
    caught: new Error(
      `Could not allocate a unique idea id after ${MAX_ID_ATTEMPTS} attempts.`,
    ),
    intention,
    observation: readiness.observation,
    outcomes,
    cleanup,
    language: observed.language,
  });
}
