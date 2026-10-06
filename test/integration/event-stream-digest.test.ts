import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { EventStream } from "../../src/foundation/event-store/index.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { git } from "../helpers/repository.ts";
import { createGitSnapshotFileSystem } from "../../src/foundation/snapshot/index.ts";
import { snapshotEventFolderHead } from "../../src/foundation/event-store/index.ts";

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
      const storageFilesystem = {
        lstat: (path: string) => filesystem.lstat(path),
        readFile: async (path: string) => {
          const bytes = await filesystem.readFile(path);
          assert.ok(Buffer.isBuffer(bytes));
          return bytes;
        },
        readdir: async (path: string) => {
          const entries = await filesystem.readdir(path);
          return entries.map((entry) => {
            assert.ok(typeof entry === "string");
            return entry;
          });
        },
        snapshotEntry: (path: string) => filesystem.snapshotEntry(path),
        snapshotEntries: (path: string) => filesystem.snapshotEntries(path),
        snapshotFile: (path: string) => filesystem.snapshotFile(path),
      };
      const paths = {
        eventsDirectory: "events",
        legacyEventsPath: "events.jsonl",
      };
      assert.equal(await snapshotEventFolderHead(root, paths, {
        objectIdLength: format === "sha1" ? 40 : 64,
      }, storageFilesystem), stream.digest);
      const empty = EventStream.fromBytes(Buffer.alloc(0), { objectIdLength: format === "sha1" ? 40 : 64 });
      assert.equal(
        git(root, "hash-object", "--no-filters", "--stdin"),
        empty.entries().at(0)?.object,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
