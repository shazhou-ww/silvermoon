import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after } from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { serializeIdeaStatus } from "../../src/ideas.js";
import { ideaPaths } from "../../src/layout.js";

export const PRIMARY_REPOSITORY =
  "https://example.test/owner/repository.git";
export const FIRST_ID = "01M36QGPNTXEPP61DA4KP4AVZF";
export const SECOND_ID = "01M36QGPNTXEPP61DA4KP4AVG0";

const defaultIdeas = [{ id: FIRST_ID, status: { alias: "fixture" } }];
const canonicalSkill = fileURLToPath(
  new URL("../../skills/silvermoon", import.meta.url),
);
let templatePromise;
let templateDirectory;

after(async () => {
  if (templateDirectory) {
    await rm(templateDirectory, { recursive: true, force: true });
  }
});

export function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

export async function writeIdea(root, id, status = {}) {
  const paths = ideaPaths(id);
  await mkdir(join(root, ...paths.idealPath.split("/")), { recursive: true });
  await writeFile(join(root, ...paths.ideaDocumentPath.split("/")), "# Fixture\n");
  await writeFile(join(root, ...paths.implementationDocumentPath.split("/")), "");
  await writeFile(join(root, ...paths.deploymentDocumentPath.split("/")), "");
  await writeFile(join(root, ...paths.ledgerPath.split("/")), "# Ledger\n");
  await writeFile(
    join(root, ...paths.statusPath.split("/")),
    serializeIdeaStatus({ version: 1, id, ...status }),
  );
  return paths;
}

export async function createRepository({
  ideas = defaultIdeas,
  objectFormat,
  preferredLanguage,
  prefix = "silvermoon-fixture-",
  withRemote = true,
  withUpstream = false,
} = {}) {
  const base = await mkdtemp(join(tmpdir(), prefix));
  const root = join(base, "work");

  if (
    ideas === defaultIdeas
    && objectFormat === undefined
    && preferredLanguage === undefined
  ) {
    const template = await getTemplate();
    if (withRemote) {
      const remote = join(base, "primary.git");
      await cp(template.work, root, { recursive: true });
      await cp(template.remote, remote, { recursive: true });
      const repository = pathToFileURL(remote).href;
      const configPath = join(root, ".git", "config");
      const config = await readFile(configPath, "utf8");
      const templateRepository = pathToFileURL(template.remote).href;
      if (!config.includes(templateRepository)) {
        throw new Error("Fixture template is missing its primary URL mapping");
      }
      await writeFile(
        configPath,
        config.replaceAll(templateRepository, () => repository),
      );
      return { base, remote, repository, root };
    }

    await cp(template.local, root, { recursive: true });
    if (withUpstream) {
      git(root, "config", "branch.main.remote", "origin");
      git(root, "config", "branch.main.merge", "refs/heads/main");
    }
    return { base, remote: null, repository: null, root };
  }

  const remote = withRemote ? join(base, "primary.git") : null;
  await mkdir(root);
  git(
    root,
    "init",
    "--initial-branch=main",
    ...(objectFormat ? [`--object-format=${objectFormat}`] : []),
  );
  git(root, "config", "user.name", "silvermoon test");
  git(root, "config", "user.email", "silvermoon@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  await mkdir(join(root, ".silvermoon", "ideas"), { recursive: true });
  await writeFile(
    join(root, ".silvermoon", "config.yaml"),
    [
      "version: 1",
      `primaryRepository: ${PRIMARY_REPOSITORY}`,
      "primaryBranch: main",
      ...(preferredLanguage ? [`preferredLanguage: ${preferredLanguage}`] : []),
      "",
    ].join("\n"),
  );
  await cp(
    canonicalSkill,
    join(root, ".agents", "skills", "silvermoon"),
    { recursive: true },
  );
  for (const idea of ideas) {
    await writeIdea(root, idea.id, idea.status);
  }
  git(root, "add", ".");
  git(root, "commit", "-m", "Create Silvermoon fixture");
  if (remote) {
    git(
      root,
      "init",
      "--bare",
      "--initial-branch=main",
      ...(objectFormat ? [`--object-format=${objectFormat}`] : []),
      remote,
    );
    const repository = pathToFileURL(remote).href;
    git(root, "config", `url.${repository}.insteadOf`, PRIMARY_REPOSITORY);
    git(root, "remote", "add", "origin", PRIMARY_REPOSITORY);
    git(root, "push", "--set-upstream", "origin", "main");
    return { base, remote, repository, root };
  }

  if (withUpstream) {
    git(root, "config", "branch.main.remote", "origin");
    git(root, "config", "branch.main.merge", "refs/heads/main");
  }
  return { base, remote: null, repository: null, root };
}

async function getTemplate() {
  if (!templatePromise) {
    templatePromise = createTemplate();
  }
  return templatePromise;
}

async function createTemplate() {
  templateDirectory = await mkdtemp(join(tmpdir(), "silvermoon-fixture-template-"));
  const root = join(templateDirectory, "work");
  const local = join(templateDirectory, "local-work");
  const remote = join(templateDirectory, "primary.git");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "silvermoon test");
  git(root, "config", "user.email", "silvermoon@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  await mkdir(join(root, ".silvermoon", "ideas"), { recursive: true });
  await writeFile(
    join(root, ".silvermoon", "config.yaml"),
    [
      "version: 1",
      `primaryRepository: ${PRIMARY_REPOSITORY}`,
      "primaryBranch: main",
      "",
    ].join("\n"),
  );
  await cp(
    canonicalSkill,
    join(root, ".agents", "skills", "silvermoon"),
    { recursive: true },
  );
  for (const idea of defaultIdeas) {
    await writeIdea(root, idea.id, idea.status);
  }
  git(root, "add", ".");
  git(root, "commit", "-m", "Create Silvermoon fixture");
  await cp(root, local, { recursive: true });
  git(root, "init", "--bare", "--initial-branch=main", remote);
  const repository = pathToFileURL(remote).href;
  git(root, "config", `url.${repository}.insteadOf`, PRIMARY_REPOSITORY);
  git(root, "remote", "add", "origin", PRIMARY_REPOSITORY);
  git(root, "push", "--set-upstream", "origin", "main");
  return { local, remote, work: root };
}

export async function setIdeaState(root, id, state, status = {}) {
  const paths = ideaPaths(id);
  const revisions = {
    approvedRevision: git(root, "rev-parse", `HEAD:${paths.idealPath}`),
    implementationAcceptedRevision: git(
      root,
      "rev-parse",
      `HEAD:${paths.innerPath}`,
    ),
    deploymentAcceptedRevision: git(
      root,
      "rev-parse",
      `HEAD:${paths.outerPath}`,
    ),
  };
  const lifecycle = {
    preparing: {},
    implementing: {
      approvedRevision: revisions.approvedRevision,
    },
    deploying: {
      approvedRevision: revisions.approvedRevision,
      implementationAcceptedRevision:
        revisions.implementationAcceptedRevision,
    },
    completed: revisions,
    abandoned: { abandoned: true },
  }[state];
  await writeFile(
    join(root, ...paths.statusPath.split("/")),
    serializeIdeaStatus({ version: 1, id, ...status, ...lifecycle }),
  );
}
