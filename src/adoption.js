import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalSkillBytes,
  evaluateNpmAdoption,
  dependencyInstallCommands as installCommands,
  isRecord, isSilvermoonSourceProject,
  packageManagerDescriptor,
  renderDependencyCommand as renderCommands,
  skillInstruction,
  workspaceRoot
} from "./adoption-policy.js";

import { loadConfig } from "./config.js";
import { diagnosticProblem } from "./dialogue.js";
import { runGit } from "./git.js";
import { traceAsync } from "./trace.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const DEFAULT_FILESYSTEM = { lstat, readFile, readdir };
const packagedSkillsRoot = resolve(packageRoot, "skills");
const packagedSkill = resolve(packagedSkillsRoot, "silvermoon");
const localSkillsRoot = "./node_modules/silvermoon/skills";
const lockfileManagers = new Map([
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
]);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export const SILVERMOON_VERSION = packageJson.version;
export const REPOSITORY_SKILL_PATH = ".agents/skills/silvermoon";
const expectedDependency = typeof SILVERMOON_VERSION === "string"
  && semverPattern.test(SILVERMOON_VERSION)
  ? `^${SILVERMOON_VERSION}`
  : null;

async function detectPackageManager(root, manifest, filesystem) {
  const workspace = workspaceRoot(manifest);
  if (Object.hasOwn(manifest, "packageManager")) {
    const declaration = manifest.packageManager;
    const match = typeof declaration === "string"
      ? /^(npm|pnpm|yarn|bun)@(.+)$/.exec(declaration)
      : null;
    if (!match || !semverPattern.test(match[2])) {
      return packageManagerDescriptor(
        null,
        workspace,
        `The root packageManager value ${JSON.stringify(declaration)} is unknown or invalid.`,
      );
    }
    return packageManagerDescriptor(match[1], workspace);
  }

  const detected = [];
  const uncertain = [];
  for (const [filename, manager] of lockfileManagers) {
    try {
      const metadata = await filesystem.lstat(resolve(root, filename));
      if (metadata.isFile()) detected.push({ filename, manager });
      else uncertain.push(filename);
    } catch (caught) {
      if (caught.code !== "ENOENT") uncertain.push(filename);
    }
  }
  if (uncertain.length > 0) {
    return packageManagerDescriptor(
      null,
      workspace,
      `Cannot safely inspect root lockfile path(s): ${uncertain.join(", ")}.`,
    );
  }
  const managers = [...new Set(detected.map(({ manager }) => manager))];
  if (managers.length > 1) {
    return packageManagerDescriptor(
      null,
      workspace,
      `Conflicting root lockfiles identify ${managers.join(", ")}.`,
    );
  }
  return packageManagerDescriptor(managers[0] ?? "npm", workspace);
}

export async function inspectNpmProject(
  snapshotRoot,
  repositoryRoot,
  {
    filesystem = DEFAULT_FILESYSTEM,
    readManifest = filesystem.readFile,
  } = {},
) {
  const manifestPath = resolve(snapshotRoot, "package.json");
  let metadata;
  try {
    metadata = await filesystem.lstat(manifestPath);
  } catch (caught) {
    if (caught.code === "ENOENT") return { npmProject: false, findings: [] };
    return {
      npmProject: true,
      findings: [{
        priority: 35,
        problem: {
          type: "npm-manifest-unreadable",
          summary: `Cannot inspect the root package.json: ${caught.message}`,
        },
        instruction: "Repair access to the root package.json, then rerun Silvermoon.",
      }],
      manifest: null,
      packageManager: { manager: null, reason: "The root manifest could not be read.", workspace: null },
    };
  }
  if (!metadata.isFile()) {
    return {
      npmProject: true,
      findings: [{
        priority: 35,
        problem: {
          type: "npm-manifest-invalid",
          summary: "The root package.json must be a regular file.",
        },
        instruction: "Replace the root package.json path with a readable regular JSON manifest.",
      }],
      manifest: null,
      packageManager: { manager: null, reason: "The root manifest is not a regular file.", workspace: null },
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(await readManifest(manifestPath, "utf8"));
  } catch (caught) {
    const invalidJson = caught instanceof SyntaxError;
    return {
      npmProject: true,
      findings: [{
        priority: 35,
        problem: {
          type: invalidJson ? "npm-manifest-invalid" : "npm-manifest-unreadable",
          summary: invalidJson
            ? `The root package.json is not valid JSON: ${caught.message}`
            : `Cannot read the root package.json: ${caught.message}`,
        },
        instruction: "Repair the root package.json as a readable JSON object, then rerun Silvermoon.",
      }],
      manifest: null,
      packageManager: { manager: null, reason: "The root manifest could not be parsed.", workspace: null },
    };
  }
  if (!isRecord(manifest)) {
    return {
      npmProject: true,
      findings: [{
        priority: 35,
        problem: {
          type: "npm-manifest-invalid",
          summary: "The root package.json must contain a JSON object.",
        },
        instruction: "Replace the root package.json contents with a valid JSON object.",
      }],
      manifest: null,
      packageManager: { manager: null, reason: "The root manifest is not a JSON object.", workspace: null },
    };
  }

  const packageManager = await detectPackageManager(
    snapshotRoot,
    manifest,
    filesystem,
  );
  const sourceCheckout = isSilvermoonSourceProject(manifest);
  const sameSourceRuntime = !sourceCheckout
    || relative(await realpath(repositoryRoot), await realpath(packageRoot)) === "";
  const findings = evaluateNpmAdoption({
    manifest, packageManager, sourceCheckout, sameSourceRuntime,
    expectedDependency, version: SILVERMOON_VERSION,
  });
  return {
    npmProject: true,
    findings,
    manifest,
    packageManager,
    sourceCheckout,
  };
}

async function directoryDigest(root, filesystem) {
  const hash = createHash("sha256");

  async function visit(directory) {
    const entries = (
      await filesystem.readdir(directory, { withFileTypes: true })
    )
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        hash.update(relative(root, path).split(sep).join("/"));
        hash.update("\0");
        hash.update(canonicalSkillBytes(await filesystem.readFile(path)));
        hash.update("\0");
      } else if (entry.isSymbolicLink()) {
        await visit(path);
      } else {
        throw new Error(`Skill contains a non-regular path: ${path}`);
      }
    }
  }

  await visit(root);
  return hash.digest("hex");
}

async function inspectSkill(contentRoot, filesystem) {
  const path = resolve(contentRoot, ...REPOSITORY_SKILL_PATH.split("/"));
  const expectedDigest = await traceAsync(
    "skill.digest-packaged",
    {},
    () => directoryDigest(packagedSkill, DEFAULT_FILESYSTEM),
  );
  let metadata;
  try {
    metadata = await filesystem.lstat(path);
  } catch (caught) {
    if (caught.code !== "ENOENT") {
      return {
        ok: false,
        problem: {
          type: "canonical-skill-invalid",
          summary: `Cannot inspect ${REPOSITORY_SKILL_PATH}: ${caught.message}`,
        },
        instruction:
          `Repair the path to ${REPOSITORY_SKILL_PATH}, then register the `
          + "canonical skill again.",
      };
    }
    return {
      ok: false,
      problem: {
        type: "canonical-skill-missing",
        summary: `Missing canonical Silvermoon skill at ${REPOSITORY_SKILL_PATH}.`,
      },
    };
  }
  if (!metadata.isDirectory() && !metadata.isSymbolicLink()) {
    return {
      ok: false,
      problem: {
        type: "canonical-skill-invalid",
        summary: `${REPOSITORY_SKILL_PATH} must be a directory or directory symlink.`,
      },
      instruction:
        `Preserve the conflicting path, then register the canonical skill at `
        + `${REPOSITORY_SKILL_PATH}.`,
    };
  }
  let actualDigest;
  try {
    actualDigest = await traceAsync(
      "skill.digest-repository",
      {},
      () => directoryDigest(path, filesystem),
    );
  } catch (caught) {
    return {
      ok: false,
      problem: {
        type: "canonical-skill-invalid",
        summary: `Cannot inspect ${REPOSITORY_SKILL_PATH}: ${caught.message}`,
      },
      instruction:
        `Repair ${REPOSITORY_SKILL_PATH}, then register the canonical skill again.`,
    };
  }
  if (actualDigest !== expectedDigest) {
    return {
      ok: false,
      problem: {
        type: "canonical-skill-mismatched",
        summary:
          `${REPOSITORY_SKILL_PATH} does not match the canonical skill bundled `
          + `with Silvermoon ${SILVERMOON_VERSION}.`,
      },
    };
  }
  return { ok: true, digest: actualDigest };
}

export async function inspectAdoption({
  contentRoot,
  filesystem = DEFAULT_FILESYSTEM,
  repositoryRoot: knownRepositoryRoot,
  root = process.cwd(),
} = {}) {
  const requestedRoot = resolve(root);
  const git = knownRepositoryRoot === undefined
    ? runGit(requestedRoot, ["rev-parse", "--show-toplevel"])
    : { ok: true, stdout: resolve(knownRepositoryRoot) };
  const repositoryRoot = git.ok ? resolve(git.stdout) : requestedRoot;
  const snapshotRoot = resolve(contentRoot ?? repositoryRoot);
  const findings = [];

  if (!git.ok) {
    findings.push({
      priority: 10,
      problem: {
        type: "git-repository-missing",
        summary: `${requestedRoot} is not an initialized Git repository.`,
      },
      instruction: `Run \`git -C "${requestedRoot}" init\`.`,
    });
  }

  const loadedConfig = await traceAsync(
    "config.load",
    {},
    () => loadConfig({ filesystem, root: snapshotRoot }),
  );
  for (const diagnostic of loadedConfig.diagnostics) {
    findings.push({
      priority: diagnostic.code === "config.unsupported-version" ? 20 : 30,
      problem: diagnosticProblem(diagnostic),
      instruction: diagnostic.remediation,
      sourceDiagnostic: diagnostic,
    });
  }

  const npm = await traceAsync(
    "npm-project.inspect",
    {},
    () => inspectNpmProject(snapshotRoot, repositoryRoot, { filesystem }),
  );
  findings.push(...npm.findings);
  const skillSource = npm.npmProject && !npm.sourceCheckout
    ? localSkillsRoot
    : packagedSkillsRoot;
  const skill = await traceAsync(
    "skill.inspect",
    {},
    () => inspectSkill(snapshotRoot, filesystem),
  );
  if (!skill.ok) {
    findings.push({
      priority: 40,
      problem: skill.problem,
      instruction: npm.sourceCheckout
        ? "From the Silvermoon source repository root, run `pnpm sync:skills` to register the current checkout's canonical skill, then rerun with `node bin/silvermoon.js`."
        : skillInstruction(skillSource, npm.packageManager ?? {
          manager: null,
          reason: "The root package manager is unknown.",
          workspace: null,
        }, packagedSkillsRoot),
    });
  }
  findings.sort((left, right) => left.priority - right.priority);

  return {
    config: loadedConfig.config,
    findings,
    gitReady: git.ok,
    instructions: findings.map(({ instruction }) => instruction),
    problems: findings.map(({ problem }) => problem),
    root: repositoryRoot,
    skill,
  };
}

export function dependencyInstallCommands(manager, workspace, version = SILVERMOON_VERSION) {
  return installCommands(manager, workspace, version);
}

export function renderDependencyCommand(manager, workspace, version = SILVERMOON_VERSION) {
  return renderCommands(manager, workspace, version);
}
