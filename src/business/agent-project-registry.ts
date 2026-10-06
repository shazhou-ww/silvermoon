import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

import { loadConfig } from "../foundation/project-config/index.ts";
import { canonicalRepository } from "../foundation/coordinates/index.ts";
import type { IdeaRoute } from "./agent-copilot.ts";

const IDEA_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(source: string, description: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) {
    throw new Error(`${description} must contain a JSON object.`);
  }
  return value;
}

function git(root: string, args: readonly string[]): string {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`Git ${args[0]} failed in ${root}: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalPath(value: string): string {
  return resolve(value).replaceAll("\\", "/").toLowerCase();
}

export function canonicalRoute(route: IdeaRoute): IdeaRoute {
  const projectUrl = canonicalRepository(route?.projectUrl);
  if (!projectUrl || !IDEA_ID.test(route?.ideaId ?? "")) {
    throw new TypeError("A canonical projectUrl and valid ideaId are required.");
  }
  return { projectUrl, ideaId: route.ideaId.toUpperCase() };
}

export class LocalProjectRegistry {
  #root: string;

  constructor({ root = join(homedir(), ".config", "silvermoon", "agents") }: { root?: string } = {}) {
    this.#root = resolve(root);
  }

  async register(projectUrl: string, projectRoot: string): Promise<void> {
    const canonical = canonicalRepository(projectUrl);
    if (!canonical) throw new TypeError("projectUrl must be a canonical credential-free HTTPS URL.");
    const path = await realpath(projectRoot);
    const actual = resolve(git(path, ["rev-parse", "--show-toplevel"]));
    if (actual !== path) throw new Error("Register a Git worktree root, not a nested directory.");
    const remotes = git(path, ["remote"]).split("\n").filter(Boolean);
    if (!remotes.some((name) => git(path, ["config", "--get", `remote.${name}.url`]) === canonical)) {
      throw new Error("No configured Git remote matches the project URL.");
    }
    const projectConfig = await loadConfig({ root: path });
    if (projectConfig.diagnostics.length || projectConfig.config?.primaryRepository !== canonical) {
      throw new Error("Registered project URL does not match the project's Silvermoon config.");
    }
    const file = join(this.#root, "projects", `${hash(canonical)}.json`);
    await mkdir(dirname(file), { recursive: true });
    let existing: Record<string, unknown> | undefined;
    try {
      existing = parseRecord(await readFile(file, "utf8"), "Project registry entry");
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    if (existing) {
      if (existing.projectUrl !== canonical || existing.projectRoot !== path) {
        throw new Error("Project is already registered at a different location; explicit relocation is required.");
      }
      return;
    }
    // Exclusive creation prevents one process from silently replacing another registration.
    await writeFile(file, `${JSON.stringify({ projectUrl: canonical, projectRoot: path })}\n`, { flag: "wx", mode: 0o600 });
  }

  async projectRoot(route: IdeaRoute): Promise<string> {
    const { projectUrl } = canonicalRoute(route);
    const file = join(this.#root, "projects", `${hash(projectUrl)}.json`);
    let entry: Record<string, unknown>;
    try {
      entry = parseRecord(await readFile(file, "utf8"), "Project registry entry");
    } catch (error) {
      if (errorCode(error) === "ENOENT") throw new Error(`Project ${projectUrl} is not registered locally.`);
      throw error;
    }
    if (entry.projectUrl !== projectUrl) throw new Error("Project registry entry does not match the requested URL.");
    if (typeof entry.projectRoot !== "string") throw new Error("Project registry entry has an invalid project root.");
    const projectRoot = await realpath(entry.projectRoot);
    if (projectRoot !== entry.projectRoot) throw new Error("Project registration moved; explicit relocation is required.");
    const configured = await loadConfig({ root: projectRoot });
    if (configured.diagnostics.length || configured.config?.primaryRepository !== projectUrl) {
      throw new Error("Project registration no longer matches its Silvermoon config.");
    }
    return projectRoot;
  }

  async resolve(route: IdeaRoute): Promise<string> {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const projectRoot = await this.projectRoot(route);
    const configured = await loadConfig({ root: projectRoot });
    if (configured.config === null) {
      throw new Error("Registered project no longer has a valid Silvermoon config.");
    }
    const ideaPath = join(projectRoot, ".silvermoon", "ideas", ideaId);
    await realpath(ideaPath);
    const worktreePath = join(await realpath(this.#root), "worktrees", hash(projectUrl), ideaId);
    const list = git(projectRoot, ["worktree", "list", "--porcelain"]);
    const registered = list.split("\n")
      .filter((line) => line.startsWith("worktree "))
      .some((line) => canonicalPath(line.slice("worktree ".length)) === canonicalPath(worktreePath));
    const remotes = git(projectRoot, ["remote"]).split("\n").filter(Boolean);
    const remote = remotes.find((name) =>
      git(projectRoot, ["config", "--get", `remote.${name}.url`]) === projectUrl);
    if (!remote) throw new Error("No configured Git remote matches the registered project.");
    const upstream = `${remote}/${configured.config.primaryBranch}`;
    const branch = `silvermoon/agent-${ideaId}`;
    if (registered) {
      if (canonicalPath(await realpath(worktreePath)) !== canonicalPath(worktreePath)) {
        throw new Error("Registered worktree path changed.");
      }
      if (git(worktreePath, ["symbolic-ref", "--short", "HEAD"]) !== branch
        || git(worktreePath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]) !== upstream) {
        throw new Error("Idea worktree branch or upstream changed; explicit repair is required.");
      }
      return worktreePath;
    }
    git(projectRoot, ["rev-parse", "--verify", `refs/remotes/${upstream}`]);
    await mkdir(dirname(worktreePath), { recursive: true });
    // Git refuses an occupied path or concurrent branch registration; never delete it.
    git(projectRoot, ["worktree", "add", "-b", branch, worktreePath, upstream]);
    git(projectRoot, ["branch", "--set-upstream-to", upstream, branch]);
    return worktreePath;
  }

  async sessionBinding(
    route: IdeaRoute,
    sessionId: string,
    worktreePath: string,
    { createIfMissing = true }: { createIfMissing?: boolean } = {},
  ): Promise<boolean> {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const file = join(this.#root, "sessions", hash(projectUrl), `${ideaId}.json`);
    await mkdir(dirname(file), { recursive: true });
    let binding: Record<string, unknown> | undefined;
    try {
      binding = parseRecord(await readFile(file, "utf8"), "Session binding");
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    if (binding) {
      if (binding.projectUrl !== projectUrl || binding.ideaId !== ideaId
        || binding.sessionId !== sessionId || binding.worktreePath !== worktreePath) {
        throw new Error("Copilot session binding changed; explicit relocation is required.");
      }
      return true;
    }
    if (!createIfMissing) return false;
    await writeFile(file, `${JSON.stringify({ projectUrl, ideaId, sessionId, worktreePath })}\n`,
      { flag: "wx", mode: 0o600 });
    return false;
  }

  async forgetSession(route: IdeaRoute, { confirmLost }: { confirmLost: true }): Promise<void> {
    if (confirmLost !== true) throw new Error("Explicit confirmation that the old session is lost is required.");
    const { projectUrl, ideaId } = canonicalRoute(route);
    const release = await this.acquire(route);
    try {
      await unlink(join(this.#root, "sessions", hash(projectUrl), `${ideaId}.json`));
    } finally {
      await release();
    }
  }

  async acquire(route: IdeaRoute): Promise<() => Promise<void>> {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const lockPath = join(this.#root, "locks", hash(projectUrl), ideaId);
    await mkdir(dirname(lockPath), { recursive: true });
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new Error(`Route ${projectUrl} / ${ideaId} is already in use; verify the owner before recovery.`);
      }
      throw error;
    }
    try {
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, host: hostname(), route: { projectUrl, ideaId } })}\n`);
    } finally {
      await handle.close();
    }
    let released = false;
    return async () => {
      if (released) return;
      await unlink(lockPath);
      released = true;
    };
  }

  async recover(route: IdeaRoute, { confirmStopped }: { confirmStopped: true }): Promise<void> {
    if (confirmStopped !== true) throw new Error("Explicit confirmation that the owner stopped is required.");
    const { projectUrl, ideaId } = canonicalRoute(route);
    const lockPath = join(this.#root, "locks", hash(projectUrl), ideaId);
    const source = await readFile(lockPath, "utf8");
    const owner = parseRecord(source, "Route lock");
    const ownerRoute = isRecord(owner.route)
      ? owner.route
      : undefined;
    if (owner.host !== hostname() || !Number.isSafeInteger(owner.pid)
      || typeof owner.pid !== "number" || owner.pid <= 0
      || ownerRoute?.projectUrl !== projectUrl || ownerRoute.ideaId !== ideaId) {
      throw new Error("Cannot verify the owner of the route lock.");
    }
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      if (errorCode(error) !== "ESRCH") throw error;
      if (await readFile(lockPath, "utf8") !== source) throw new Error("Route lock changed during recovery.");
      await unlink(lockPath);
      return;
    }
    throw new Error(`Route owner process ${owner.pid} is still running.`);
  }
}
