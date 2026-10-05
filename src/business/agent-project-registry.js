import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

import { loadConfig } from "../foundation/project-config/index.js";
import { canonicalRepository } from "../foundation/coordinates/index.js";

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

function canonicalPath(value) {
  return resolve(value).replaceAll("\\", "/").toLowerCase();
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

  async projectRoot(route) {
    const { projectUrl } = canonicalRoute(route);
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
    const configured = await loadConfig({ root: projectRoot });
    if (configured.diagnostics.length || configured.config?.primaryRepository !== projectUrl) {
      throw new Error("Project registration no longer matches its Silvermoon config.");
    }
    return projectRoot;
  }

  async resolve(route) {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const projectRoot = await this.projectRoot(route);
    const configured = await loadConfig({ root: projectRoot });
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

  async sessionBinding(route, sessionId, worktreePath, { createIfMissing = true } = {}) {
    const { projectUrl, ideaId } = canonicalRoute(route);
    const file = join(this.#root, "sessions", hash(projectUrl), `${ideaId}.json`);
    await mkdir(dirname(file), { recursive: true });
    let binding;
    try {
      binding = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
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

  async forgetSession(route, { confirmLost } = {}) {
    if (confirmLost !== true) throw new Error("Explicit confirmation that the old session is lost is required.");
    const { projectUrl, ideaId } = canonicalRoute(route);
    const release = await this.acquire(route);
    try {
      await unlink(join(this.#root, "sessions", hash(projectUrl), `${ideaId}.json`));
    } finally {
      await release();
    }
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
