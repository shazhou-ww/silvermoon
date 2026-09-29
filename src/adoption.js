import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
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
const packagedSkillsRoot = resolve(packageRoot, "skills");
const packagedSkill = resolve(packagedSkillsRoot, "silvermoon");
const utf8Decoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

export const SILVERMOON_VERSION = packageJson.version;
export const REPOSITORY_SKILL_PATH = ".agents/skills/silvermoon";

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

async function directoryDigest(root) {
  const hash = createHash("sha256");

  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        hash.update(relative(root, path).split(sep).join("/"));
        hash.update("\0");
        hash.update(canonicalSkillBytes(await readFile(path)));
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

async function inspectSkill(contentRoot) {
  const path = resolve(contentRoot, ...REPOSITORY_SKILL_PATH.split("/"));
  const expectedDigest = await traceAsync(
    "skill.digest-packaged",
    {},
    () => directoryDigest(packagedSkill),
  );
  let metadata;
  try {
    metadata = await lstat(path);
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
      instruction:
        `Run \`npx skills add "${packagedSkillsRoot}" --skill silvermoon `
        + "--agent universal --yes --copy`.",
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
      () => directoryDigest(path),
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
      instruction:
        `Review local skill changes, then run \`npx skills add "${packagedSkillsRoot}" `
        + "--skill silvermoon --agent universal --yes --copy`.",
    };
  }
  return { ok: true, digest: actualDigest };
}

export async function inspectAdoption({
  contentRoot,
  root = process.cwd(),
} = {}) {
  const requestedRoot = resolve(root);
  const git = runGit(requestedRoot, ["rev-parse", "--show-toplevel"]);
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
    () => loadConfig({ root: snapshotRoot }),
  );
  for (const diagnostic of loadedConfig.diagnostics) {
    findings.push({
      priority: diagnostic.code === "config.unsupported-version" ? 20 : 30,
      problem: diagnosticProblem(diagnostic),
      instruction: diagnostic.remediation,
      sourceDiagnostic: diagnostic,
    });
  }

  const skill = await traceAsync(
    "skill.inspect",
    {},
    () => inspectSkill(snapshotRoot),
  );
  if (!skill.ok) {
    findings.push({
      priority: 40,
      problem: skill.problem,
      instruction: skill.instruction,
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
