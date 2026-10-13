import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createObjectiveLoader, fileObjectiveResources } from "../../src/objective-guide/index.ts";

test("default file resolver loads JSON/YAML, nested References and canonical file URI aliases", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-guide-"));
  try {
    await mkdir(join(root, "refs", "nested"), { recursive: true });
    const path = join(root, "manifest.yaml");
    await writeFile(path, `schemaVersion: 1
domainSchema:
  type: object
levels:
  - id: configuration-invalid
    advancement:
      checks: [ready]
defaultLanguage: en-US
localizations:
  en-US:
    content: content.json
    references:
      source: refs/
`);
    await writeFile(join(root, "content.json"), JSON.stringify({
      title: "Project", description: "Prepared project",
      terminal: { title: "Ready", description: "All ready" },
      levels: { "configuration-invalid": { title: "Invalid", description: "Configuration is not valid", outcome: "Repair to continue" } },
    }));
    await writeFile(join(root, "refs", "404.md"), '---\nid: "404"\n---\n# Not found\n\nNo such page.\n');
    await writeFile(join(root, "refs", "nested", "arbitrary-name.md"), "---\nid: project-unready\n---\n# Repair project\n\nSee [[404]].\n");
    const loader = createObjectiveLoader({
      checks: { ready: async () => ({ pass: false, problems: [{ pageId: "project-unready", description: "Fix configuration." }] }) },
    });

    const guide = await loader.load(path);
    assert.equal(await loader.load(pathToFileURL(path).href), guide);
    const result = guide.createInstance({ subject: {} });
    if (!result.ok) assert.fail("Expected instance.");
    const sample = await result.instance.probe();
    assert.equal(sample.current.id, "configuration-invalid");
    assert.equal((await sample.current.instance.readPage(sample.problems[0]!.pageId)).title, "Repair project");
    assert.equal((await result.instance.readPage("arbitrary-name")).id, "404");
    assert.deepEqual(await result.instance.searchPages("repair"), [{ id: "project-unready", title: "Repair project" }]);
    await rm(join(root, "refs", "404.md"));
    await assert.rejects(createObjectiveLoader({ checks: { ready: async () => ({ pass: true }) } }).load(path), /Missing not-found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file resources reject invalid UTF-8 and non-directory References sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-guide-encoding-"));
  try {
    const path = join(root, "404.md");
    await writeFile(path, Buffer.from([0xff]));
    await assert.rejects(fileObjectiveResources.readText(pathToFileURL(path).href), TypeError);
    await assert.rejects(fileObjectiveResources.readPages(pathToFileURL(path).href), /regular directory/);
    await assert.rejects(fileObjectiveResources.readPages(pathToFileURL(root).href), TypeError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
