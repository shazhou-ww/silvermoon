import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { LocalProjectRegistry } from "../../src/agents/project-registry.js";

const URL = "https://github.com/example/project.git";
const IDEA = "01M3SK3CGZF47A36D2GWN8BFPC";

test("requires registration and persistently binds one idea worktree", async () => {
  const base = await mkdtemp(join(tmpdir(), "silvermoon-registry-"));
  const projectRoot = join(base, "project");
  const root = join(base, "registry");
  const route = { projectUrl: URL, ideaId: IDEA };
  const registry = new LocalProjectRegistry({ root });
  try {
    await assert.rejects(registry.resolve(route), /not registered/);
    await mkdir(join(projectRoot, ".silvermoon", "ideas", IDEA), { recursive: true });
    await writeFile(join(projectRoot, ".silvermoon", "config.yaml"), `version: 2\nprimaryRepository: ${URL}\nprimaryBranch: main\n`);
    await writeFile(join(projectRoot, ".silvermoon", "ideas", IDEA, "events.jsonl"), "");
    execFileSync("git", ["init", "-q", projectRoot]);
    execFileSync("git", ["-C", projectRoot, "remote", "add", "origin", URL]);
    execFileSync("git", ["-C", projectRoot, "add", ".silvermoon"]);
    execFileSync("git", ["-C", projectRoot, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Fixture"]);
    execFileSync("git", ["-C", projectRoot, "update-ref", "refs/remotes/origin/main", "HEAD"]);
    await assert.rejects(registry.register("https://github.com/other/project.git", projectRoot), /remote matches/);
    await registry.register(URL, projectRoot);
    await registry.register(URL, projectRoot);
    const release = await registry.acquire(route);
    await assert.rejects(registry.acquire(route), /already in use/);
    await release();
    const releaseAgain = await registry.acquire(route);
    await releaseAgain();
    const first = await registry.resolve(route);
    assert.equal(await new LocalProjectRegistry({ root }).resolve(route), first);
    assert.equal((await readFile(join(first, ".silvermoon", "config.yaml"), "utf8")).includes(URL), true);
    assert.equal(execFileSync("git", ["-C", first, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { encoding: "utf8" }).trim(), "origin/main");
    await assert.rejects(registry.register(URL, join(base, "other")), /ENOENT/);
    execFileSync("git", ["-C", projectRoot, "worktree", "remove", first]);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
