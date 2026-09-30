import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeGitCommands } from "../../src/git.js";
import { inspectPhaseGuidance } from "../../src/guidance.js";
import {
  GUIDANCE_ROOT,
  phaseGuidancePath,
} from "../../src/layout.js";
import {
  CHANGE_SAMPLE_ITEM_LIMIT,
  whatsNext,
} from "../../src/whatsnext.js";
import { renderResponse } from "../../src/response.js";
import {
  createRepository,
  FIRST_ID,
  git,
  PRIMARY_REPOSITORY,
  SECOND_ID,
  setIdeaState,
} from "../helpers/repository.js";
import { createWhatsNextTestHelpers } from "../helpers/whatsnext.js";

const {
  envelopeKeys,
  fixture,
  pushPeerChange,
  responseText,
  trackTemporaryDirectory,
} = createWhatsNextTestHelpers(afterEach);
const DEPLOYING_ID = "01M36QGPNTXEPP61DA4KP4AVG1";
const COMPLETED_ID = "01M36QGPNTXEPP61DA4KP4AVG2";
const ABANDONED_ID = "01M36QGPNTXEPP61DA4KP4AVG3";

test("records fetch failure as a failure outcome with a trustworthy envelope", async () => {
  const repository = await fixture();
  await rm(repository.remote, { recursive: true });

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-sync-required");
  assert.equal(report.observation.problems[0].type, "primary-fetch-failed");
  assert.equal(report.actions.at(-1).type, "fetch-primary");
  assert.equal(report.actions.at(-1).status, "failure");
  assert.match(responseText(report), /network|网络/);
});

test("rejects an unsupported programmatic output language before repository inspection", async () => {
  const repository = await fixture();
  const commands = [];

  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => whatsNext({
        language: "fr-FR",
        root: repository.root,
      }),
    ),
    (error) => error.exitCode === 2,
  );
  assert.deepEqual(commands, []);
});

test("attaches only the selected actionable phase guidance from primary", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  const fixtures = [
    [FIRST_ID, "preparing", "# Prepare\n\nPreparing only.\n"],
    [SECOND_ID, "implementing", "# Implement\n\nImplementing only.\n"],
    [DEPLOYING_ID, "deploying", "# Deploy\n\nDeploying only.\n"],
  ];
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  for (const [, phase, content] of fixtures) {
    await writeFile(
      join(repository.root, ...phaseGuidancePath(phase).split("/")),
      content,
    );
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add phase guidance");
  git(repository.root, "push", "origin", "main");

  for (const [id, phase, content] of fixtures) {
    const report = await whatsNext({
      idea: id,
      language: "zh-CN",
      root: repository.root,
      userHome: repository.base,
    });
    const path = phaseGuidancePath(phase);

    assert.equal(report.observation.state, "idea-selected");
    assert.deepEqual(report.observation.guidance, {
      phase,
      path,
      contentRevision: git(repository.root, "rev-parse", `HEAD:${path}`),
    });
    assert.equal(report.response.guidance.content, content);
    assert.equal(
      fixtures
        .filter(([, candidate]) => candidate !== phase)
        .some(([, , otherContent]) =>
          JSON.stringify(report).includes(otherContent.trim())
        ),
      false,
    );
    assert.match(responseText(report), /revision/);
    assert.doesNotMatch(responseText(report), /Preparing only|Implementing only|Deploying only/);
  }
});

test("loads guidance only after an actionable idea becomes the next action", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "active" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set terminal idea states");
  git(repository.root, "push", "origin", "main");
  let reads = 0;
  const guidanceReader = async () => {
    reads += 1;
    throw new Error("guidance must not be read");
  };

  for (const options of [
    {},
    { idea: "unknown" },
    { idea: COMPLETED_ID },
    { idea: ABANDONED_ID },
  ]) {
    const report = await whatsNext({
      ...options,
      guidanceReader,
      root: repository.root,
      userHome: repository.base,
    });
    assert.notEqual(report.observation.state, "phase-guidance-invalid");
  }

  await writeFile(join(repository.root, "dirty.txt"), "preserve\n");
  const blocked = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(blocked.observation.state, "repository-sync-required");
  assert.equal(reads, 0);
});

test("does not load guidance while setup, upstream, or fetch readiness is blocked", async () => {
  let reads = 0;
  const guidanceReader = async () => {
    reads += 1;
    throw new Error("guidance must not be read");
  };

  const setup = await fixture();
  await rm(join(setup.root, ".agents"), { recursive: true });
  const setupReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: setup.root,
    userHome: setup.base,
  });
  assert.equal(setupReport.observation.state, "project-setup-required");

  const upstream = await fixture();
  git(upstream.root, "branch", "--unset-upstream");
  const upstreamReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: upstream.root,
    userHome: upstream.base,
  });
  assert.equal(upstreamReport.observation.state, "repository-sync-required");

  const fetch = await fixture();
  await rm(fetch.remote, { recursive: true });
  const fetchReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: fetch.root,
    userHome: fetch.base,
  });
  assert.equal(fetchReport.observation.state, "repository-sync-required");
  assert.equal(fetchReport.observation.problems[0].type, "primary-fetch-failed");
  assert.equal(reads, 0);
});

test("current guidance failures block lifecycle instructions without cross-phase leakage", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...phaseGuidancePath("preparing").split("/")),
    "Prepare safely.\n",
  );
  await mkdir(
    join(repository.root, ...phaseGuidancePath("implementing").split("/")),
  );
  await writeFile(
    join(
      repository.root,
      ...phaseGuidancePath("implementing").split("/"),
      "nested.md",
    ),
    "invalid\n",
  );
  await writeFile(
    join(repository.root, GUIDANCE_ROOT, "unexpected.md"),
    "ignored on demand\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add mixed guidance");
  git(repository.root, "push", "origin", "main");

  const preparing = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  const implementing = await whatsNext({
    idea: SECOND_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(preparing.observation.state, "idea-selected");
  assert.equal(preparing.response.guidance.content, "Prepare safely.\n");
  assert.equal(
    Object.hasOwn(preparing.observation.guidance, "content"),
    false,
  );
  assert.equal(implementing.observation.state, "phase-guidance-invalid");
  assert.deepEqual(
    implementing.observation.problems.map(({ type }) => type),
    ["guidance-file-invalid"],
  );
  assert.equal(Object.hasOwn(implementing.observation, "guidance"), false);
  assert.doesNotMatch(
    responseText(implementing),
    /implementationAcceptedRevision/,
  );
  assert.match(responseText(implementing), /implementing\.md/);
});

test("keeps a formed guidance report bound to the inspected snapshot", async () => {
  const repository = await fixture();
  const path = phaseGuidancePath("preparing");
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(join(repository.root, ...path.split("/")), "Original guidance.\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add preparing guidance");
  git(repository.root, "push", "origin", "main");
  const expectedRevision = git(repository.root, "rev-parse", `HEAD:${path}`);

  const report = await whatsNext({
    guidanceReader: async (options) => {
      const inspected = await inspectPhaseGuidance(options);
      await writeFile(
        join(repository.root, ...path.split("/")),
        "Concurrent replacement.\n",
      );
      return inspected;
    },
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.response.guidance.content, "Original guidance.\n");
  assert.equal(
    report.observation.guidance.contentRevision,
    expectedRevision,
  );
});
