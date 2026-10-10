import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after } from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { serializeIdeaStatus } from "../../src/foundation/idea-model/index.ts";
import {
  parseIdeaEvents,
  serializeIdeaEvents,
  type IdeaEvent,
} from "../../src/foundation/event-codec/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";

type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type IdeaStatusFixture = Record<string, JsonValue | undefined>;
export interface IdeaFixture {
  id: string;
  status: IdeaStatusFixture;
}
export interface RepositoryFixtureOptions {
  ideas?: IdeaFixture[];
  objectFormat?: string;
  preferredLanguage?: string;
  prefix?: string;
  schemaVersion?: 1 | 2;
  withRemote?: boolean;
  withUpstream?: boolean;
}

export const PRIMARY_REPOSITORY =
  "https://example.test/owner/repository.git";
export const FIRST_ID = "01M36QGPNTXEPP61DA4KP4AVZF";
export const SECOND_ID = "01M36QGPNTXEPP61DA4KP4AVG0";

const defaultIdeas = [{ id: FIRST_ID, status: { alias: "fixture" } }];
const templatePromises = new Map<1 | 2, ReturnType<typeof createTemplate>>();
const templateDirectories: string[] = [];

after(async () => {
  await Promise.all(
    templateDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
  templatePromises.clear();
});

export function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

export async function writeIdea(
  root: string,
  id: string,
  status: IdeaStatusFixture = {},
  schemaVersion: 1 | 2 = 1,
) {
  const paths = ideaPaths(id);
  await mkdir(join(root, ...paths.idealPath.split("/")), { recursive: true });
  await writeFile(join(root, ...paths.ideaDocumentPath.split("/")), "# Fixture\n");
  await writeFile(join(root, ...paths.implementationDocumentPath.split("/")), "");
  await writeFile(join(root, ...paths.deploymentDocumentPath.split("/")), "");
  await writeFile(join(root, ...paths.ledgerPath.split("/")), "# Ledger\n");
  if (schemaVersion === 1) {
    await writeFile(
      join(root, ...paths.statusPath.split("/")),
      serializeIdeaStatus({ version: 1, id, ...status }, {}),
    );
  } else {
    await writeFile(
      join(root, ...paths.eventsPath.split("/")),
      serializeFixtureEvents(status),
    );
  }
  return paths;
}

function serializeFixtureEvents(status: IdeaStatusFixture) {
  const events: Array<{
    sequence: number;
    type: string;
    payload?: Record<string, JsonValue | undefined>;
  }> = [];
  const fields = [
    ["alias", "setAlias", "alias"],
    ["language", "setLanguage", "language"],
    ["approvedRevision", "acceptIdeal", "idealRevision"],
    [
      "implementationAcceptedRevision",
      "acceptInner",
      "implementationRevision",
    ],
    ["deploymentAcceptedRevision", "acceptOuter", "deploymentRevision"],
  ] as const;
  for (const [field, type, payloadField] of fields) {
    const value = status[field];
    if (typeof value === "string" || value === null) {
      events.push({
        sequence: events.length + 1,
        type,
        payload: { [payloadField]: value },
      });
    }
  }
  if (status.abandoned === true) {
    events.push({ sequence: events.length + 1, type: "abandon" });
  }
  return serializeIdeaEvents(events);
}

export async function createRepository({
  ideas = defaultIdeas,
  objectFormat,
  preferredLanguage,
  prefix = "silvermoon-fixture-",
  schemaVersion = 1,
  withRemote = true,
  withUpstream = false,
}: RepositoryFixtureOptions = {}) {
  const base = await mkdtemp(join(tmpdir(), prefix));
  const root = join(base, "work");

  if (
    ideas === defaultIdeas
    && objectFormat === undefined
    && preferredLanguage === undefined
  ) {
    const template = await getTemplate(schemaVersion);
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
  git(root, "config", "maintenance.auto", "false");
  git(root, "config", "gc.auto", "0");
  await mkdir(join(root, ".silvermoon", "ideas"), { recursive: true });
  if (schemaVersion === 2) {
    await writeFile(
      join(root, ".gitattributes"),
      "**/events.jsonl -text -filter\n",
    );
  }
  await writeFile(
    join(root, ".silvermoon", "config.yaml"),
    [
      `version: ${schemaVersion}`,
      `primaryRepository: ${PRIMARY_REPOSITORY}`,
      "primaryBranch: main",
      ...(preferredLanguage ? [`preferredLanguage: ${preferredLanguage}`] : []),
      "",
    ].join("\n"),
  );
  for (const idea of ideas) {
    await writeIdea(root, idea.id, idea.status, schemaVersion);
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

async function getTemplate(schemaVersion: 1 | 2) {
  let templatePromise = templatePromises.get(schemaVersion);
  if (!templatePromise) {
    templatePromise = createTemplate(schemaVersion);
    templatePromises.set(schemaVersion, templatePromise);
  }
  return templatePromise;
}

async function createTemplate(schemaVersion: 1 | 2) {
  const templateDirectory = await mkdtemp(
    join(tmpdir(), `silvermoon-v${schemaVersion}-fixture-template-`),
  );
  templateDirectories.push(templateDirectory);
  const root = join(templateDirectory, "work");
  const local = join(templateDirectory, "local-work");
  const remote = join(templateDirectory, "primary.git");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "silvermoon test");
  git(root, "config", "user.email", "silvermoon@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "maintenance.auto", "false");
  git(root, "config", "gc.auto", "0");
  await mkdir(join(root, ".silvermoon", "ideas"), { recursive: true });
  if (schemaVersion === 2) {
    await writeFile(
      join(root, ".gitattributes"),
      "**/events.jsonl -text -filter\n",
    );
  }
  await writeFile(
    join(root, ".silvermoon", "config.yaml"),
    [
      `version: ${schemaVersion}`,
      `primaryRepository: ${PRIMARY_REPOSITORY}`,
      "primaryBranch: main",
      "",
    ].join("\n"),
  );
  for (const idea of defaultIdeas) {
    await writeIdea(root, idea.id, idea.status, schemaVersion);
  }
  git(root, "add", ".");
  git(root, "commit", "-m", "Create Silvermoon fixture");
  git(
    root,
    "-c",
    "core.autocrlf=false",
    "clone",
    "--no-local",
    root,
    local,
  );
  git(local, "remote", "remove", "origin");
  git(local, "config", "user.name", "silvermoon test");
  git(local, "config", "user.email", "silvermoon@example.invalid");
  git(local, "config", "core.autocrlf", "false");
  git(root, "clone", "--bare", "--no-local", root, remote);
  const repository = pathToFileURL(remote).href;
  git(root, "config", `url.${repository}.insteadOf`, PRIMARY_REPOSITORY);
  git(root, "remote", "add", "origin", PRIMARY_REPOSITORY);
  git(root, "push", "--set-upstream", "origin", "main");
  return { local, remote, work: root };
}

export async function setIdeaState(
  root: string,
  id: string,
  state: "preparing" | "implementing" | "deploying" | "completed" | "abandoned",
  status: IdeaStatusFixture = {},
) {
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
  const config = await readFile(
    join(root, ".silvermoon", "config.yaml"),
    "utf8",
  );
  const schemaVersion = /^version: 2$/m.test(config) ? 2 : 1;
  const nextStatus = { ...status, ...lifecycle };
  await writeFile(
    join(
      root,
      ...(schemaVersion === 1 ? paths.statusPath : paths.eventsPath).split("/"),
    ),
    schemaVersion === 1
      ? serializeIdeaStatus({ version: 1, id, ...nextStatus }, {})
      : serializeFixtureEvents(nextStatus),
  );
}

export async function submitIdeaState(
  root: string,
  id: string,
  state: "preparing" | "implementing" | "deploying",
) {
  const paths = ideaPaths(id);
  const eventsPath = join(root, ...paths.eventsPath.split("/"));
  const events = [...parseIdeaEvents(await readFile(eventsPath))];
  const sequence = events.length + 1;
  let candidate: IdeaEvent;
  if (state === "preparing") {
    candidate = {
      sequence,
      type: "submitIdeal",
      payload: {
        idealRevision: git(root, "rev-parse", `HEAD:${paths.idealPath}`),
      },
    };
  } else if (state === "implementing") {
    candidate = {
      sequence,
      type: "submitInner",
      payload: {
        implementationRevision: git(
          root,
          "rev-parse",
          `HEAD:${paths.innerPath}`,
        ),
      },
    };
  } else {
    candidate = {
      sequence,
      type: "submitOuter",
      payload: {
        deploymentRevision: git(root, "rev-parse", `HEAD:${paths.outerPath}`),
      },
    };
  }
  events.push(candidate);
  await writeFile(eventsPath, serializeIdeaEvents(events));
}

export async function appendIdeaSignal(
  root: string,
  id: string,
  type: "ping" | "pong",
  message: string,
) {
  const paths = ideaPaths(id);
  const eventsPath = join(root, ...paths.eventsPath.split("/"));
  const events = [...parseIdeaEvents(await readFile(eventsPath))];
  events.push({
    sequence: events.length + 1,
    type,
    payload: { message },
  });
  await writeFile(eventsPath, serializeIdeaEvents(events));
}
