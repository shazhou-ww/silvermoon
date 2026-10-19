import assert from "node:assert/strict";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { linkPersonalSkill } from "../../src/foundation/installation/personal-skill-link.ts";
import { directoryContentRevision } from "../../src/foundation/installation/skill-content-revision.ts";

test("skill content revisions are path-independent and cover every regular file", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-skill-revision-"));
  const left = join(root, "left");
  const right = join(root, "right");
  try {
    await mkdir(join(left, "references"), { recursive: true });
    await writeFile(join(left, "SKILL.md"), "skill\n");
    await writeFile(join(left, "references", "guide.md"), "guide\n");
    await cp(left, right, { recursive: true });

    const expected = await directoryContentRevision(left);
    assert.match(expected, /^sha256:[a-f0-9]{64}$/);
    assert.equal(await directoryContentRevision(right), expected);

    await writeFile(join(right, "references", "guide.md"), "changed\n");
    assert.notEqual(await directoryContentRevision(right), expected);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("links the canonical skill and safely replaces links or an identical copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-skill-link-"));
  const home = join(root, "home");
  const source = join(root, "source");
  const destination = join(home, ".agents", "skills", "silvermoon");
  try {
    await mkdir(join(source, "references"), { recursive: true });
    await writeFile(join(source, "SKILL.md"), "---\nname: silvermoon\n---\n");
    await writeFile(join(source, "references", "guide.md"), "guide\n");

    const created = await linkPersonalSkill({ home, skillRoot: source });
    assert.equal(created.status, "created");
    assert.equal((await lstat(destination)).isSymbolicLink(), true);
    assert.equal(await realpath(destination), await realpath(source));

    const unchanged = await linkPersonalSkill({ home, skillRoot: source });
    assert.equal(unchanged.status, "already-linked");

    await rm(destination);
    const stale = join(root, "stale");
    await mkdir(stale);
    await writeFile(join(stale, "SKILL.md"), "stale\n");
    await symlink(
      stale,
      destination,
      process.platform === "win32" ? "junction" : "dir",
    );
    const relinked = await linkPersonalSkill({ home, skillRoot: source });
    assert.equal(relinked.status, "relinked");
    assert.equal(await realpath(destination), await realpath(source));

    await rm(destination);
    await cp(source, destination, { recursive: true });
    const replaced = await linkPersonalSkill({ home, skillRoot: source });
    assert.equal(replaced.status, "replaced-copy");
    assert.equal(await realpath(destination), await realpath(source));

    await rm(destination);
    await cp(source, destination, { recursive: true });
    await writeFile(join(destination, "SKILL.md"), "locally modified\n");
    await assert.rejects(
      linkPersonalSkill({ home, skillRoot: source }),
      /not an unmodified copy/,
    );
    assert.equal(
      await readFile(join(destination, "SKILL.md"), "utf8"),
      "locally modified\n",
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
