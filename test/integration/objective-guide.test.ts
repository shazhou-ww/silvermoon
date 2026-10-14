import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  createObjectiveLoader, fileObjectiveResources, ObjectiveConfigurationError,
} from "../../src/objective-guide/index.ts";

async function page(root: string, id: string, language: string, properties: Record<string, string>, body = "") {
  const path = join(root, "references", ...id.split("/"), `${language}.md`);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `---\n${Object.entries(properties)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n${body}\n`);
}

test("file runtime executes a shebang check and loads convention-based References", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-guide-"));
  try {
    const manifestPath = join(root, "manifest.yaml");
    await writeFile(manifestPath, `schemaVersion: 1
domainSchema:
  type: object
levels:
  - id: configuration-invalid
    advancement:
      checks: [ready]
defaultLanguage: en-US
languages: [en-US, zh-CN]
`);
    for (const language of ["en-US", "zh-CN"]) {
      await page(root, "system/overview", language, { title: "Project", description: "Prepared project" });
      await page(root, "system/404", language, { title: "Not found", description: "No such page" });
      await page(root, "levels/configuration-invalid", language, {
        title: "Invalid", description: "Configuration is not valid", outcome: "Repair to continue",
      });
      await page(root, "levels/terminal", language, { title: "Ready", description: "All ready" });
      await page(root, "checks/ready", language, { title: "Ready check", description: "Checks readiness" });
      await page(root, "problems/project-unready", language, {
        title: "Repair project", description: "Fix configuration",
      }, "See [[system/404]].");
    }
    const checkDirectory = join(root, "checks", "ready");
    await mkdir(checkDirectory, { recursive: true });
    const entry = join(checkDirectory, "run.js");
    await writeFile(entry, `#!/usr/bin/env node
let source = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => source += chunk);
process.stdin.on("end", async () => {
  const request = JSON.parse(source);
  await require("node:fs/promises").writeFile(
    require("node:path").join(request.probe.tempDirectory, "sample.json"),
    JSON.stringify(request.subject)
  );
  process.stdout.write(JSON.stringify({
    pass: false,
    problems: [{ id: "project-unready", parameters: { configurationPath: "config.yaml" } }]
  }));
});
`);
    if (process.platform !== "win32") await chmod(entry, 0o755);

    const loader = createObjectiveLoader();
    const guide = await loader.load(manifestPath);
    assert.equal(await loader.load(pathToFileURL(manifestPath).href), guide);
    const result = guide.createInstance({ subject: {} });
    if (!result.ok) assert.fail("Expected instance.");
    const sample = await result.instance.probe();
    assert.equal(sample.position.level.id, "configuration-invalid");
    assert.equal(sample.position.failingCheck, "ready");
    assert.equal(sample.position.problems[0]?.id, "project-unready");
    assert.equal(sample.position.problems[0]?.parameters.configurationPath, "config.yaml");
    assert.equal((await sample.position.owner.readPage("problems/project-unready")).title, "Repair project");
    assert.equal((await result.instance.readPage("missing")).id, "system/404");
    assert.deepEqual(await result.instance.searchPages("repair"), [
      { id: "problems/project-unready", title: "Repair project" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file runtime rejects ambiguous entries, invalid UTF-8 and non-directory References", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-guide-invalid-"));
  try {
    const path = join(root, "invalid.md");
    await writeFile(path, Buffer.from([0xff]));
    await assert.rejects(fileObjectiveResources.readText(pathToFileURL(path).href), TypeError);
    await assert.rejects(fileObjectiveResources.readPages(pathToFileURL(path).href), /regular directory/);
    await assert.rejects(fileObjectiveResources.readPages(pathToFileURL(root).href), TypeError);

    const checkDirectory = join(root, "checks", "ready");
    await mkdir(checkDirectory, { recursive: true });
    await Promise.all([
      writeFile(join(checkDirectory, "run.js"), "#!/usr/bin/env node\n"),
      writeFile(join(checkDirectory, "run.py"), "#!/usr/bin/env python3\n"),
    ]);
    const runner = (await import("../../src/objective-guide/index.ts")).fileObjectiveCheckRunner;
    await assert.rejects(runner.run(pathToFileURL(join(root, "manifest.yaml")).href, "ready", {
      protocolVersion: 1, subject: {}, probe: { tempDirectory: root },
    }), ObjectiveConfigurationError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
