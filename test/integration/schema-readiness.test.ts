import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../../src/business/check-repository.ts";
import { whatsNext } from "../../src/business/whats-next.ts";
import { observeDevice } from "../../src/business/shared/observe-device.ts";
import { observeSnapshot } from "../../src/business/shared/observe-snapshot.ts";
import { renderMarkdownResponse } from "../../src/foundation/renderer/index.ts";
import type { DeviceAdvisory } from "../../src/foundation/report/types.ts";
import {
  createRepository,
  FIRST_ID,
  writeIdea,
} from "../helpers/repository.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

test("historical schemas remain check-valid but block lifecycle preparation", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-schema-historical-",
  });
  temporaryDirectories.push(repository.base);
  const options = { root: repository.root, userHome: repository.base };

  const check = await checkRepository(options);
  assert.equal(check.response.kind, "validation-result");
  assert.equal(check.response.validation.valid, true);
  assert.equal(check.observation.schemas?.files.length, 2);
  assert.ok(check.observation.schemas?.files.every(
    ({ readiness }) => readiness === "migration-required",
  ));
  assert.deepEqual(check.observation.problems, []);

  const preparation = await whatsNext(options);
  assert.equal(preparation.observation.state, "project-setup-required");
  assert.equal(preparation.response.kind, "blocked");
  assert.deepEqual(
    preparation.observation.problems.map(({ type }) => type),
    ["schema-migration-required"],
  );
  assert.deepEqual(
    preparation.response.schemas,
    preparation.observation.schemas,
  );
  const markdown = renderMarkdownResponse(preparation.response, {
    dateFacts: new Map(),
    now: new Date("2025-01-01T00:00:00.000Z"),
  });
  assert.match(markdown, /Project schema preparation/);
  assert.match(markdown, /\.silvermoon\/config\.yaml/);
  assert.match(markdown, /migration-required/);
  assert.equal(
    preparation.response.nextSteps?.filter(({ text }) =>
      text.includes("silvermoon migrate")
    ).length,
    1,
  );
});

test("current schemas stay available in JSON without adding Markdown noise", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-schema-current-",
    schemaVersion: 2,
  });
  temporaryDirectories.push(repository.base);

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  assert.ok(report.observation.schemas?.files.every(
    ({ readiness, validity }) =>
      readiness === "current" && validity === "valid",
  ));
  assert.deepEqual(report.response.schemas, report.observation.schemas);
  const markdown = renderMarkdownResponse(report.response, {
    dateFacts: new Map(),
    now: new Date("2025-01-01T00:00:00.000Z"),
  });
  assert.doesNotMatch(markdown, /Project schema preparation/);
});

test("one preparation report accumulates current, historical, invalid and future files", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-schema-mixed-",
    schemaVersion: 2,
    withRemote: false,
  });
  temporaryDirectories.push(repository.base);
  const mixed = {
    historical: "01M36QGPNTXEPP61DA4KP4AVZA",
    invalid: "01M36QGPNTXEPP61DA4KP4AVZB",
    future: "01M36QGPNTXEPP61DA4KP4AVZC",
  };
  for (const [kind, id] of Object.entries(mixed)) {
    const paths = await writeIdea(repository.root, id, { alias: kind }, 1);
    if (kind !== "historical") {
      await writeFile(
        join(repository.root, ...paths.statusPath.split("/")),
        kind === "invalid"
          ? `version: 1
id: ${id}
abandoned: invalid
`
          : `version: 3
id: ${id}
`,
      );
    }
  }

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "project-setup-required");
  assert.deepEqual(
    report.observation.schemas?.files.map((file) => [
      file.path,
      file.validity,
      file.readiness,
    ]),
    [
      [".silvermoon/config.yaml", "valid", "current"],
      [
        `.silvermoon/ideas/${mixed.historical}/status.yaml`,
        "valid",
        "migration-required",
      ],
      [
        `.silvermoon/ideas/${mixed.invalid}/status.yaml`,
        "invalid",
        "migration-required",
      ],
      [
        `.silvermoon/ideas/${mixed.future}/status.yaml`,
        "unsupported",
        "runtime-upgrade-required",
      ],
      [
        `.silvermoon/ideas/${FIRST_ID}/events.jsonl`,
        "valid",
        "current",
      ],
    ],
  );
  assert.deepEqual(
    report.observation.problems.map(({ type }) => type),
    [
      "schema-migration-required",
      "schema-invalid",
      "schema-runtime-upgrade-required",
    ],
  );
});

test("future schemas force one refresh and distinguish all freshness outcomes", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-schema-future-",
    schemaVersion: 2,
    withRemote: false,
  });
  temporaryDirectories.push(repository.base);
  await writeFile(
    join(repository.root, ".silvermoon", "config.yaml"),
    `version: 3
primaryRepository: https://example.test/owner/repository.git
primaryBranch: main
`,
  );
  const deterministicCheck = await checkRepository({
    root: repository.root,
    userHome: repository.base,
    worktree: true,
  });
  assert.equal(deterministicCheck.response.kind, "validation-result");
  if (deterministicCheck.response.kind !== "validation-result") {
    assert.fail("check must return a validation response");
  }
  assert.equal(deterministicCheck.response.validation.valid, false);
  assert.equal(Object.hasOwn(deterministicCheck.observation, "device"), false);
  assert.ok(deterministicCheck.observation.problems.every(
    ({ type }) => type === "schema-runtime-upgrade-required",
  ));
  assert.ok(deterministicCheck.observation.schemas?.files.some(
    ({ validity }) => validity === "unsupported",
  ));

  const outcomes: Array<{
    type: string;
    update: DeviceAdvisory["update"];
  }> = [
    {
      type: "schema-runtime-update-available",
      update: {
        status: "available",
        currentVersion: "0.4.0",
        latestVersion: "0.5.0",
        checkedAt: "2025-01-01T00:00:00.000Z",
        source: "registry",
      },
    },
    {
      type: "schema-runtime-latest-unsupported",
      update: {
        status: "current",
        currentVersion: "0.4.0",
        latestVersion: "0.4.0",
        checkedAt: "2025-01-01T00:00:00.000Z",
        source: "registry",
      },
    },
    {
      type: "schema-runtime-freshness-unavailable",
      update: {
        status: "unavailable",
        currentVersion: "0.4.0",
        source: "registry",
        summary: "registry unavailable",
      },
    },
  ];

  for (const { type, update } of outcomes) {
    let calls = 0;
    const report = await observeSnapshot({
      deviceObserver: async (options) => {
        calls += 1;
        assert.equal(options.forceRuntimeRefresh, true);
        const observed = await observeDevice(options);
        assert.ok(observed.readiness);
        return {
          ...observed,
          readiness: {
            ...observed.readiness,
            runtime: {
              source: "global" as const,
              version: "0.4.0",
            },
            update,
          },
        };
      },
      root: repository.root,
      userHome: repository.base,
      version: { type: "worktree" },
    });

    assert.equal(calls, 1);
    assert.ok(report.observation.schemas?.files.some(
      ({ readiness }) => readiness === "runtime-upgrade-required",
    ));
    assert.ok(report.observation.problems.length > 0);
    assert.ok(report.observation.problems.every(
      (problem) => problem.type === type,
    ));
  }
});
