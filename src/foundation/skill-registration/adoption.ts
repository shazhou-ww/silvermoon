import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGit } from "../git/index.ts";
import { loadConfig } from "../project-config/index.ts";
import { diagnosticProblem } from "../report/index.ts";
import { traceAsync } from "../trace/index.ts";
import type { BusinessFileSystem } from "../../business/shared/business-types.ts";

type AdoptionFileSystem = Pick<BusinessFileSystem, "lstat" | "readFile">;

interface Utf8FileSystem {
  lstat: AdoptionFileSystem["lstat"];
  readFile(path: string, encoding: "utf8"): Promise<string>;
}

const packageRoot = fileURLToPath(new URL(
  import.meta.url.endsWith(".ts") ? "../../.." : "../../../..",
  import.meta.url,
));
const packageJson = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);
const DEFAULT_FILESYSTEM = { lstat, readFile };

function utf8FileSystem(filesystem: AdoptionFileSystem): Utf8FileSystem {
  return {
    lstat: filesystem.lstat,
    async readFile(path, encoding) {
      return (await filesystem.readFile(path)).toString(encoding);
    },
  };
}

export const SILVERMOON_VERSION = packageJson.version;

export async function inspectAdoption({
  contentRoot,
  filesystem = DEFAULT_FILESYSTEM,
  repositoryRoot: knownRepositoryRoot,
  root = process.cwd(),
}: {
  contentRoot?: string;
  filesystem?: AdoptionFileSystem;
  repositoryRoot?: string;
  root?: string;
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
    () => loadConfig({
      filesystem: utf8FileSystem(filesystem),
      root: snapshotRoot,
    }),
  );
  for (const diagnostic of loadedConfig.diagnostics) {
    if (diagnostic.code === undefined) {
      throw new Error(
        `Configuration diagnostic is missing a code: ${diagnostic.message}`,
      );
    }
    findings.push({
      priority: diagnostic.code === "config.unsupported-version" ? 20 : 30,
      problem: diagnosticProblem({ ...diagnostic, code: diagnostic.code }),
      instruction: diagnostic.remediation,
      sourceDiagnostic: { ...diagnostic, code: diagnostic.code },
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
  };
}
