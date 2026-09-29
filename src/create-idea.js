import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  diagnosticProblem,
  dialogueReadyObservation,
  localize,
} from "./dialogue.js";
import { createCommandRun } from "./domain.js";
import { inspectPhaseGuidance } from "./guidance.js";
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
  phaseGuidanceInstructions,
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
    caught.createdDirectories = created;
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

function cleanupResult(results) {
  return {
    removed: results.filter(({ status }) => status === "removed").length,
    preserved: results.filter(({ status }) => status.startsWith("preserved")).length,
    items: results,
  };
}

function failureReport({
  cleanup,
  problem: actionProblem,
  observation,
  runtime,
  language,
}) {
  const problem = {
    type: "idea-scaffold-failed",
    summary: localize(
      language,
      `Idea creation failed: ${actionProblem.summary} ${cleanupSummary(cleanup.items)}`,
      `创建 idea 失败：${actionProblem.summary} ${cleanupSummary(cleanup.items)}`,
    ),
  };
  return runtime.complete(
    dialogueReadyObservation(observation, "idea-create-failed", {
      cleanup,
      problems: [...observation.problems, problem],
    }),
    {
      nextSteps: localize(
        language,
        "Preserve any reported paths, resolve the filesystem error, and retry `silvermoon create-idea`.",
        "保留报告中的路径，解决文件系统错误后，再运行 `silvermoon create-idea`。",
      ),
    },
  );
}

function projectCreationObservation(observation) {
  const { ideas: _ideas, ...project } = observation;
  if (project.observedThrough === "ideas") {
    project.observedThrough = "configuration";
  }
  return project;
}

function withCleanupPlan(caught, cleanupPlan) {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  error.cleanupPlan = cleanupPlan;
  return error;
}

async function cleanupScaffold(cleanupPlan, operations) {
  const read = operations.readFile ?? readFile;
  const remove = operations.rm ?? rm;
  const removeDirectory = operations.rmdir ?? rmdir;
  const results = [];
  for (const [path, source] of [...cleanupPlan.cleanupFiles].reverse()) {
    try {
      results.push(await removeOwnedFile(path, source, read, remove));
    } catch (caught) {
      results.push({
        path,
        status: "preserved",
        error: caught.message,
      });
    }
  }
  results.push(...await removeCreatedDirectories(
    cleanupPlan.createdDirectories,
    removeDirectory,
  ));
  if (cleanupPlan.collisionPath) {
    results.push({
      path: cleanupPlan.collisionPath,
      status: "preserved-existing",
    });
  }
  results.push(...await removeCreatedDirectories(
    cleanupPlan.rootDirectories,
    removeDirectory,
  ));
  return cleanupResult(results);
}

async function createScaffold({
  canonicalLanguage,
  generateId,
  operations,
  repositoryRoot,
}) {
  const inspect = operations.lstat ?? lstat;
  const makeDirectory = operations.mkdir ?? mkdir;
  const write = operations.writeFile ?? writeFile;
  const fileOperations = {
    inspect,
    makeDirectory,
  };
  let rootDirectories;
  try {
    rootDirectories = await ensureDirectoryPath(
      repositoryRoot,
      IDEAS_ROOT,
      fileOperations,
    );
  } catch (caught) {
    throw withCleanupPlan(caught, {
      cleanupFiles: [],
      collisionPath: null,
      createdDirectories: [],
      rootDirectories: caught.createdDirectories ?? [],
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
      throw withCleanupPlan(caught, {
        cleanupFiles: [],
        collisionPath: null,
        createdDirectories: [],
        rootDirectories,
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
      return {
        createdIdea: {
          id,
          path: paths.ideaPath,
          state: "preparing",
        },
        paths,
      };
    } catch (caught) {
      throw withCleanupPlan(caught, {
        cleanupFiles,
        collisionPath,
        createdDirectories,
        rootDirectories,
      });
    }
  }

  throw withCleanupPlan(
    new Error(`Could not allocate a unique idea id after ${MAX_ID_ATTEMPTS} attempts.`),
    {
      cleanupFiles: [],
      collisionPath: null,
      createdDirectories: [],
      rootDirectories,
    },
  );
}

export async function createIdea({
  generateId = generateUlid,
  guidanceReader = inspectPhaseGuidance,
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
  const runtime = createCommandRun(intention);
  const observed = await observeSnapshot({
    allowMissingIdeas: true,
    ideaLanguage: canonicalLanguage,
    root: requestedRoot,
    userHome,
    version: { type: "worktree" },
  });
  runtime.observe(projectCreationObservation(observed.observation), {
    factType: "project.snapshot",
  });
  const recheckCommand = canonicalLanguage === undefined
    ? "silvermoon create-idea"
    : `silvermoon create-idea --language ${canonicalLanguage}`;
  if (!observed.projectReady) {
    return runtime.complete(
      projectCreationObservation(observed.observation),
      {
        nextSteps: projectInstructions(
          observed,
          observed.observation.root,
          observed.outputLanguage,
          recheckCommand,
        ),
      },
    );
  }
  const repositoryRoot = observed.observation.root;
  const readiness = await assessIdeaCreationReadiness({
    observed,
    runtime,
    recheckCommand,
    root: repositoryRoot,
  });
  if (!readiness.ready) {
    return runtime.complete(
      dialogueReadyObservation(
        readiness.observation,
        "repository-preparation-required",
      ),
      { nextSteps: readiness.instructions },
    );
  }

  const inspectedGuidance = await guidanceReader({
    gitRoot: repositoryRoot,
    phase: "preparing",
    snapshotTree: readiness.head,
  });
  if (inspectedGuidance.state === "invalid") {
    return runtime.complete(
      dialogueReadyObservation(
        readiness.observation,
        "phase-guidance-invalid",
        {
          problems: inspectedGuidance.diagnostics.map((diagnostic) =>
            diagnosticProblem(diagnostic, observed.outputLanguage)
          ),
        },
      ),
      {
        nextSteps: phaseGuidanceInstructions(
          inspectedGuidance.diagnostics,
          repositoryRoot,
          observed.outputLanguage,
          recheckCommand,
        ),
      },
    );
  }

  const completion = await runtime.performAction(
    {
      type: "create-idea-scaffold",
      contentLanguage: observed.contentLanguage,
    },
    () => createScaffold({
      canonicalLanguage,
      generateId,
      operations,
      repositoryRoot,
    }),
    (caught) => ({
      problem: {
        type: "idea-scaffold-failed",
        summary: caught.message,
      },
      internal: { cleanupPlan: caught.cleanupPlan },
    }),
  );
  if (completion.status === "failure") {
    const cleanupCompletion = await runtime.performAction(
      { type: "remove-owned-creation-paths" },
      () => cleanupScaffold(
        completion.internal.cleanupPlan,
        operations,
      ),
      (caught) => ({
        problem: {
          type: "idea-cleanup-failed",
          summary: caught.message,
        },
      }),
    );
    const cleanup = cleanupCompletion.status === "success"
      ? cleanupCompletion.result
      : {
        removed: 0,
        preserved: 1,
        items: [{
          path: repositoryRoot,
          status: "preserved",
          error: cleanupCompletion.problem.summary,
        }],
      };
    return failureReport({
      cleanup,
      problem: completion.problem,
      observation: readiness.observation,
      runtime,
      language: observed.outputLanguage,
    });
  }

  const { createdIdea, paths } = completion.result;
  return runtime.complete(
    dialogueReadyObservation(readiness.observation, "idea-created", {
      createdIdea,
      ...(inspectedGuidance.guidance === undefined
        ? {}
        : { guidance: inspectedGuidance.guidance }),
    }),
    {
      nextSteps: localize(
        observed.outputLanguage,
        `Use ${observed.contentLanguage} for natural-language content while describing the requested Ideal World in ${paths.ideaDocumentPath}; keep the stable IDs and placeholders in ${paths.implementationDocumentPath}, ${paths.deploymentDocumentPath}, and ${paths.ledgerPath} synchronized.`,
        `使用 ${observed.contentLanguage} 在 ${paths.ideaDocumentPath} 中描述请求的理想契约，并保持 ${paths.implementationDocumentPath}、${paths.deploymentDocumentPath} 与 ${paths.ledgerPath} 中的稳定 ID 和占位同步。`,
      ),
    },
  );
}
