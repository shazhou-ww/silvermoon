import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import {
  gitContentDigest,
  snapshotEventFileHead,
} from "../../src/foundation/event-store/index.ts";
import { createGitSnapshotFileSystem } from "../../src/foundation/snapshot/index.ts";
import { git } from "../helpers/repository.ts";

test("events.jsonl digest equals its Git blob OID in SHA-1 and SHA-256 repositories", async () => {
  for (const format of ["sha1", "sha256"]) {
    const root = await mkdtemp(join(tmpdir(), "silvermoon-stream-digest-"));
    try {
      git(root, "init", "--initial-branch=main", `--object-format=${format}`);
      const source = Buffer.from(serializeIdeaEvents(Array.from(
        { length: 1001 },
        (_, index) => ({
          sequence: index + 1,
          type: "pong",
          payload: { message: `record ${index + 1}` },
        }),
      )));
      await writeFile(join(root, "events.jsonl"), source);
      await writeFile(join(root, ".gitattributes"), "**/events.jsonl -text -filter\n");
      await writeFile(join(root, "unrelated.txt"), "not part of this stream\n");
      git(root, "add", ".");
      const tree = git(root, "write-tree");
      const objectIdLength = format === "sha1" ? 40 : 64;
      const blob = git(root, "rev-parse", `${tree}:events.jsonl`);
      assert.equal(blob, gitContentDigest("blob", source, { objectIdLength }));
      assert.equal(
        git(root, "hash-object", "--no-filters", "events.jsonl"),
        blob,
      );
      assert.notEqual(tree, blob);
      const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree });
      filesystem.readFile = () => {
        throw new Error("HEAD calculation must not read immutable blob bytes");
      };
      assert.equal(
        await snapshotEventFileHead(
          root,
          { eventsPath: "events.jsonl" },
          { objectIdLength },
          filesystem,
        ),
        blob,
      );
      assert.equal(
        git(root, "hash-object", "--no-filters", "--stdin"),
        gitContentDigest("blob", Buffer.alloc(0), { objectIdLength }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
