import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { diagnosticProblem } from "./dialogue.js";
import { loadConfig } from "./config.js";
import { runGit } from "./git.js";
import { traceAsync } from "./trace.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const DEFAULT_FILESYSTEM = { lstat, readFile, readdir };
const packagedSkillsRoot = resolve(packageRoot, "skills");
const packagedSkill = resolve(packagedSkillsRoot, "silvermoon");
const localSkillsRoot = "./node_modules/silvermoon/skills";
const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const lockfileManagers = new Map([
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
]);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const utf8Decoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

export const SILVERMOON_VERSION = packageJson.version;
export const REPOSITORY_SKILL_PATH = ".agents/skills/silvermoon";
const expectedDependency = typeof SILVERMOON_VERSION === "string"
  && semverPattern.test(SILVERMOON_VERSION)
  ? `^${SILVERMOON_VERSION}`
  : null;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSilvermoonSourceProject(manifest) {
  const repositoryUrl = manifest.repository?.url;
  if (
    manifest.name !== "silvermoon"
    || typeof repositoryUrl !== "string"
  ) {
    return false;
  }
  const normalizedUrl = repositoryUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
  return normalizedUrl === "https://github.com/shazhou-ww/silvermoon";
}

function workspaceRoot(manifest) {
  if (!Object.hasOwn(manifest, "workspaces")) return false;
  const workspaces = manifest.workspaces;
  const packages = Array.isArray(workspaces)
    ? workspaces
    : isRecord(workspaces)
      ? workspaces.packages
      : null;
  if (!Array.isArray(packages) || !packages.every((item) => typeof item === "string")) {
    return null;
  }
  return packages.length > 0;
}

function packageManagerDescriptor(manager, workspace, reason = null) {
  if (reason || !manager || workspace === null) {
    return {
      manager: null,
      reason: reason ?? (workspace === null
        ? "The root workspaces field is not in a recognized form."
        : "The package manager could not be determined safely."),
      workspace,
    };
  }
  return {
    manager,
    reason: null,
    workspace,
  };
}

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

export function dependencyInstallCommands(manager, workspace, version = SILVERMOON_VERSION) {
  const packageSpecifier = `silvermoon@^${version}`;
  if (manager === "npm") {
    return [{ executable: "npm", args: ["install", "--save-dev", packageSpecifier] }];
  }
  if (manager === "pnpm") {
    return [{
      executable: "pnpm",
      args: [
        "add",
        "--save-dev",
        packageSpecifier,
        ...(workspace ? ["--workspace-root"] : []),
      ],
    }];
  }
  if (manager === "yarn") {
    return [
      {
        executable: "npm",
        args: ["pkg", "set", `devDependencies.silvermoon=^${version}`],
      },
      { executable: "yarn", args: ["install"] },
    ];
  }
  if (manager === "bun") {
    return [{ executable: "bun", args: ["add", packageSpecifier, "--dev"] }];
  }
  return null;
}

function renderCommand({ executable, args }) {
  return [executable, ...args]
    .map((argument) => argument.includes("^") || argument.includes(" ")
      ? `"${argument.replaceAll('"', '\\"')}"`
      : argument)
    .join(" ");
}

export function renderDependencyCommand(manager, workspace, version = SILVERMOON_VERSION) {
  const commands = dependencyInstallCommands(manager, workspace, version);
  return commands ? commands.map(renderCommand).join("\n") : null;
}

function dependencyInstruction(packageManager) {
  const renderedCommands = packageManager.manager
    ? renderDependencyCommand(
      packageManager.manager,
      packageManager.workspace,
      SILVERMOON_VERSION,
    )
    : null;
  if (!expectedDependency) {
    return `The running Silvermoon version ${JSON.stringify(SILVERMOON_VERSION)} is not a supported SemVer version; repair the package before declaring its dependency.`;
  }
  if (!renderedCommands) {
    return `Do not guess a package-manager command. ${packageManager.reason} Resolve the root package-manager/workspace configuration, then add silvermoon@${expectedDependency} to the root devDependencies.`;
  }
  const commands = renderedCommands.split("\n");
  if (commands.length === 1) {
    return `From the repository root, run \`${commands[0]}\` to set root devDependencies.silvermoon to ${expectedDependency}.`;
  }
  return `From the repository root, run these commands in order: ${commands.map((command) => `\`${command}\``).join(", then ")} to set root devDependencies.silvermoon to ${expectedDependency}.`;
}

function skillInstruction(skill, packageManager) {
  const registration = `npx skills add "${skill}" --skill silvermoon --agent universal --yes --copy`;
  if (skill === packagedSkillsRoot) {
    return `Run \`${registration}\`.`;
  }
  const install = packageManager.manager
    ? `run \`${packageManager.manager} install\``
    : "install dependencies with the resolved project package manager";
  return `After you add the required Silvermoon devDependency and ${install} at the repository root, run \`${registration}\`.`;
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
  const findings = [];
  const sourceCheckout = isSilvermoonSourceProject(manifest);
  if (sourceCheckout && relative(await realpath(repositoryRoot), await realpath(packageRoot)) !== "") {
    findings.push({
      priority: 35,
      problem: {
        type: "source-checkout-runtime-required",
        summary: "The Silvermoon source project must use its own checkout runtime, not an installed package or another checkout.",
      },
      instruction: "From the target repository root, rerun the same command and options with `node bin/silvermoon.js` instead of `silvermoon`. Do not add a Silvermoon dependency to its own source project.",
    });
  } else if (!expectedDependency) {
    findings.push({
      priority: 35,
      problem: {
        type: "npm-runtime-version-invalid",
        summary: `The running Silvermoon version ${JSON.stringify(SILVERMOON_VERSION)} is not a supported SemVer version.`,
      },
      instruction: "Use a Silvermoon package with a valid SemVer version before adopting this npm project.",
    });
  } else if (!sourceCheckout) {
    const declarations = dependencySections
      .filter((section) => isRecord(manifest[section]) && Object.hasOwn(manifest[section], "silvermoon"));
    const hasDevDependency = declarations.includes("devDependencies");
    const actual = isRecord(manifest.devDependencies)
      ? manifest.devDependencies.silvermoon
      : undefined;
    if (!hasDevDependency) {
      findings.push({
        priority: 35,
        problem: {
          type: declarations.length > 0
            ? "npm-dependency-wrong-section"
            : "npm-dependency-missing",
          summary: declarations.length > 0
            ? "The root Silvermoon dependency must be declared in devDependencies."
            : `The root devDependencies.silvermoon must be ${expectedDependency}.`,
        },
        instruction: dependencyInstruction(packageManager),
      });
    } else if (actual !== expectedDependency) {
      findings.push({
        priority: 35,
        problem: {
          type: "npm-dependency-version-mismatch",
          summary: `The root devDependencies.silvermoon must be exactly ${expectedDependency}; found ${JSON.stringify(actual)}.`,
        },
        instruction: dependencyInstruction(packageManager),
      });
    }
    if (declarations.length > 1) {
      findings.push({
        priority: 36,
        problem: {
          type: "npm-dependency-duplicate",
          summary: `Silvermoon is declared in multiple root dependency sections: ${declarations.join(", ")}.`,
        },
        instruction: `Remove duplicate Silvermoon declarations and keep only devDependencies.silvermoon at ${expectedDependency}.`,
      });
    }
  }
  return {
    npmProject: true,
    findings,
    manifest,
    packageManager,
    sourceCheckout,
  };
}

function canonicalSkillBytes(content) {
  if (content.includes(0)) return content;
  try {
    return Buffer.from(
      utf8Decoder.decode(content).replaceAll("\r\n", "\n"),
      "utf8",
    );
  } catch {
    return content;
  }
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
        }),
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
