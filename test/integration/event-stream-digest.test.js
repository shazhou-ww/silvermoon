import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { EventStream } from "../../src/foundation/event-store/index.js";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.js";
import { git } from "../helpers/repository.js";
import { createGitSnapshotFileSystem } from "../../src/foundation/snapshot/index.js";
import { snapshotEventFolderHead } from "../../src/foundation/event-store/index.js";

test("events-folder digest equals its Git subtree OID in SHA-1 and SHA-256 repositories", async () => {
  for (const format of ["sha1", "sha256"]) {
    const root = await mkdtemp(join(tmpdir(), "silvermoon-stream-digest-"));
    try {
      git(root, "init", "--initial-branch=main", `--object-format=${format}`);
      await mkdir(join(root, "events"));
      const source = Buffer.from(serializeIdeaEvents(Array.from({ length: 1001 }, (_, index) => ({
        sequence: index + 1, type: "pong", payload: { message: `记录 ${index + 1}` },
      }))));
      const stream = EventStream.fromBytes(source, { objectIdLength: format === "sha1" ? 40 : 64 });
      for (const { name, bytes, object } of stream.entries()) {
        await writeFile(join(root, "events", name), bytes);
        assert.equal(git(root, "hash-object", "--no-filters", join("events", name)), object);
      }
      await writeFile(join(root, ".gitattributes"), "**/*.jsonl -text\n");
      await writeFile(join(root, "unrelated.txt"), "not part of this stream\n");
      git(root, "add", ".");
      const tree = git(root, "write-tree");
      assert.equal(git(root, "rev-parse", `${tree}:events`), stream.digest);
      assert.notEqual(tree, stream.digest);
      const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree });
      filesystem.readFile = () => { throw new Error("HEAD must not read historical segment bodies"); };
      const paths = { eventsDirectory: "events" };
      assert.equal(await snapshotEventFolderHead(root, paths, {
        objectIdLength: format === "sha1" ? 40 : 64,
      }, filesystem), stream.digest);
      const empty = EventStream.fromBytes(Buffer.alloc(0), { objectIdLength: format === "sha1" ? 40 : 64 });
      assert.equal(git(root, "hash-object", "--no-filters", "--stdin"), empty.entries()[0].object);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
