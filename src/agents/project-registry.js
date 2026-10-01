import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

import { canonicalRepository } from "../repository.js";

const IDEA_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`Git ${args[0]} failed in ${root}: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalRoute(route) {
  const projectUrl = canonicalRepository(route?.projectUrl);
  if (!projectUrl || !IDEA_ID.test(route?.ideaId ?? "")) {
    throw new TypeError("A canonical projectUrl and valid ideaId are required.");
  }
  return { projectUrl, ideaId: route.ideaId.toUpperCase() };
}

export class LocalProjectRegistry {
  #root;

  constructor({ root = join(homedir(), ".config", "silvermoon", "agents") } = {}) {
    this.#root = resolve(root);
  }

  async register(projectUrl, projectRoot) {
    const canonical = canonicalRepository(projectUrl);
    if (!canonical) throw new TypeError("projectUrl must be a canonical credential-free HTTPS URL.");
    const path = await realpath(projectRoot);
    const actual = git(path, ["rev-parse", "--show-toplevel"]);
    if (actual !== path) throw new Error("Register a Git worktree root, not a nested directory.");
    const remotes = git(path, ["remote"]).split("\n").filter(Boolean);
    if (!remotes.some((name) => git(path, ["config", "--get", `remote.${name}.url`]) === canonical)) {
      throw new Error("No configured Git remote matches the project URL.");
    }
    const projectConfig = await readFile(join(path, ".silvermoon", "config.yaml"), "utf8");
    if (!projectConfig.split(/\r?\n/).includes(`primaryRepository: ${canonical}`)) {
      throw new Error("Registered project URL does not match the project's Silvermoon config.");
    }
    const file = join(this.#root, "projects", `${hash(canonical)}.json`);
    await mkdir(dirname(file), { recursive: true });
    let existing;
    try {
      existing = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
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

  async resolve(route) {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const file = join(this.#root, "projects", `${hash(projectUrl)}.json`);
    let entry;
    try {
      entry = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Project ${projectUrl} is not registered locally.`);
      throw error;
    }
    if (entry.projectUrl !== projectUrl) throw new Error("Project registry entry does not match the requested URL.");
    const projectRoot = await realpath(entry.projectRoot);
    if (projectRoot !== entry.projectRoot) throw new Error("Project registration moved; explicit relocation is required.");
    const configured = await readFile(join(projectRoot, ".silvermoon", "config.yaml"), "utf8");
    if (!configured.split(/\r?\n/).includes(`primaryRepository: ${projectUrl}`)) {
      throw new Error("Project registration no longer matches its Silvermoon config.");
    }
    const ideaPath = join(projectRoot, ".silvermoon", "ideas", ideaId);
    await realpath(ideaPath);
    const worktreePath = join(await realpath(this.#root), "worktrees", hash(projectUrl), ideaId);
    const list = git(projectRoot, ["worktree", "list", "--porcelain"]);
    const registered = list.split("\n").some((line) => line === `worktree ${worktreePath}`);
    if (registered) {
      if (await realpath(worktreePath) !== worktreePath) throw new Error("Registered worktree path changed.");
      return worktreePath;
    }
    await mkdir(dirname(worktreePath), { recursive: true });
    // Git refuses an occupied path or concurrent worktree registration; never delete it.
    git(projectRoot, ["worktree", "add", "--detach", worktreePath, "HEAD"]);
    return worktreePath;
  }

  async acquire(route) {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const lockPath = join(this.#root, "locks", hash(projectUrl), ideaId);
    await mkdir(dirname(lockPath), { recursive: true });
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") {
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

  async recover(route, { confirmStopped } = {}) {
    if (confirmStopped !== true) throw new Error("Explicit confirmation that the owner stopped is required.");
    const { projectUrl, ideaId } = canonicalRoute(route);
    const lockPath = join(this.#root, "locks", hash(projectUrl), ideaId);
    const source = await readFile(lockPath, "utf8");
    const owner = JSON.parse(source);
    if (owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
      || owner.route?.projectUrl !== projectUrl || owner.route?.ideaId !== ideaId) {
      throw new Error("Cannot verify the owner of the route lock.");
    }
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      if (await readFile(lockPath, "utf8") !== source) throw new Error("Route lock changed during recovery.");
      await unlink(lockPath);
      return;
    }
    throw new Error(`Route owner process ${owner.pid} is still running.`);
  }
}
