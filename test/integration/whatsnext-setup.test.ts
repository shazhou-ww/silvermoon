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

import { observeGitCommands } from "../../src/foundation/git/index.ts";
import { inspectPhaseGuidance } from "../../src/foundation/guidance/index.ts";
import { ideaCreatedAt } from "../../src/foundation/idea-query/index.ts";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/foundation/coordinates/index.ts";
import {
  CHANGE_SAMPLE_ITEM_LIMIT,
  whatsNext,
} from "../../src/business/whats-next.ts";
import { renderResponse } from "../../src/foundation/renderer/index.ts";
import {
  createRepository,
  FIRST_ID,
  git,
  PRIMARY_REPOSITORY,
  SECOND_ID,
  setIdeaState,
} from "../helpers/repository.ts";
import { createWhatsNextTestHelpers } from "../helpers/whatsnext.ts";

const {
  envelopeKeys,
  fixture,
  pushPeerChange,
  trackTemporaryDirectory,
} = createWhatsNextTestHelpers(afterEach);
const DEPLOYING_ID = "01M36QGPNTXEPP61DA4KP4AVG1";
const COMPLETED_ID = "01M36QGPNTXEPP61DA4KP4AVG2";
const ABANDONED_ID = "01M36QGPNTXEPP61DA4KP4AVG3";

type WhatsNextReport = Awaited<ReturnType<typeof whatsNext>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseText(report: WhatsNextReport) {
  if (!("nextSteps" in report.response)) return "";
  return report.response.nextSteps.map(({ text }) => text).join("\n");
}

function responseReview(report: WhatsNextReport) {
  assert.equal(report.response.kind, "next-steps");
  if (report.response.kind !== "next-steps") {
    assert.fail("selected idea must return next steps");
  }
  assert.ok(report.response.review);
  return report.response.review;
}

function firstProblem(report: WhatsNextReport) {
  const [problem] = report.observation.problems;
  assert.ok(problem);
  return problem;
}

function firstAction(report: WhatsNextReport) {
  const [action] = report.actions;
  assert.ok(action);
  return action;
}

function choices(report: WhatsNextReport) {
  assert.ok("choices" in report.response);
  return report.response.choices;
}

function ideas(report: WhatsNextReport) {
  assert.ok("ideas" in report.observation);
  const value = report.observation.ideas;
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.counts));
  assert.ok(Array.isArray(value.activeIdeas));
  const activeIdeas = value.activeIdeas.map((idea: unknown) => {
    assert.ok(isRecord(idea));
    assert.ok(typeof idea.id === "string");
    return { id: idea.id };
  });
  return { counts: value.counts, activeIdeas };
}

function configuration(report: WhatsNextReport) {
  const value = report.observation.configuration;
  assert.ok(value);
  return value;
}

function actionCommit(report: WhatsNextReport) {
  const action = firstAction(report);
  assert.ok("result" in action);
  assert.ok(isRecord(action.result));
  assert.ok(typeof action.result.commit === "string");
  return action.result.commit;
}

function recordCommands(commands: string[][]) {
  return (args: unknown) => {
    assert.ok(Array.isArray(args));
    assert.ok(args.every((arg) => typeof arg === "string"));
    commands.push(args.map(String));
  };
}

test("project setup uses cumulative observation variants and reports all setup fixes", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-unconfigured-"));
  trackTemporaryDirectory(root);

  const missingGit = await whatsNext({
    language: "zh-cn",
    root,
    userHome: root,
  });
  assert.equal(missingGit.observation.state, "project-setup-required");
  assert.ok("observedThrough" in missingGit.observation);
  assert.equal(missingGit.observation.observedThrough, "root");
  assert.equal(missingGit.intention.args.language, "zh-CN");
  assert.equal(missingGit.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(missingGit.observation, "version"), false);
  assert.deepEqual(
    missingGit.observation.problems.map(({ type }: { type: string }) => type),
    ["git-repository-missing", "config-missing"],
  );
  assert.equal(missingGit.actions.length, 0);
  assert.match(responseText(missingGit), /^1\. .*\n2\. /);
  assert.match(responseText(missingGit), /处理/);

  const configured = await fixture();
  await writeFile(
    join(configured.root, ".silvermoon", "config.yaml"),
    `version: 3
primaryRepository: ${PRIMARY_REPOSITORY}
primaryBranch: main
`,
  );
  git(configured.root, "add", ".");
  git(configured.root, "commit", "-m", "Break configuration");
  const invalidConfig = await whatsNext({
    root: configured.root,
    userHome: configured.base,
  });
  assert.ok("observedThrough" in invalidConfig.observation);
  assert.equal(invalidConfig.observation.observedThrough, "version");
  assert.deepEqual(invalidConfig.observation.version, { type: "worktree" });
  assert.equal(
    Object.hasOwn(invalidConfig.observation, "configuration"),
    false,
  );
  assert.ok(
    invalidConfig.observation.problems.some(
      ({ type }: { type: string }) =>
        type === "schema-runtime-upgrade-required",
    ),
  );

  const invalidLayout = await fixture({ preferredLanguage: "zh-CN" });
  const paths = ideaPaths(FIRST_ID);
  await rm(join(invalidLayout.root, ...paths.ledgerPath.split("/")));
  const observedIdeas = await whatsNext({
    root: invalidLayout.root,
    userHome: invalidLayout.base,
  });
  assert.ok("observedThrough" in observedIdeas.observation);
  assert.equal(Object.hasOwn(observedIdeas.observation, "ideas"), false);
  assert.equal(observedIdeas.observation.observedThrough, "configuration");
  assert.equal(
    firstProblem(observedIdeas).type,
    "idea-ledger-missing-file",
  );
  assert.match(firstProblem(observedIdeas).summary, /^在 .*ledger\.md 发现/);
  assert.match(responseText(observedIdeas), /^修复/);
  assert.doesNotMatch(responseText(observedIdeas), /^\d+\. /m);
});

test("package metadata does not participate in lifecycle navigation", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, "package.json"),
    JSON.stringify({ name: "consumer" }, null, 2) + "\n",
  );
  git(repository.root, "add", "package.json");
  git(repository.root, "commit", "-m", "Add package metadata");
  git(repository.root, "push", "origin", "main");
  const commands: string[][] = [];

  const report = await observeGitCommands(
    recordCommands(commands),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "idea-selected");
  assert.deepEqual(report.observation.problems, []);
  assert.equal(commands.some(([name]) => name === "fetch"), true);
  assert.doesNotMatch(responseText(report), /silvermoon@\^[0-9]+\.[0-9]+\.[0-9]+/);
});

test("[selector-none] naked navigation lists one active idea without selecting it", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(envelopeKeys(report), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.deepEqual(report.intention, {
    command: "whats-next",
    args: { idea: null, language: null },
  });
  assert.equal(report.observation.outputLanguage, "en-US");
  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
    alias: "fixture",
    title: "Fixture",
  }]);
  assert.equal(
    report.response.summary,
    "Current state: navigation-ready. 1 active idea(s) are available.",
  );
  assert.deepEqual(choices(report), report.observation.ideas.activeIdeas);
  const rendered = renderResponse(report.response);
  assert.match(rendered, /### Active ideas/);
  assert.match(rendered, /\| Alias \/ ID \| State \| Created \| Title \|/);
  assert.match(
    rendered,
    /\| fixture \| preparing \| .* \| Fixture \|/,
  );
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /silvermoon whats-next <ULID-or-alias>/);
  assert.match(responseText(report), /silvermoon create-idea/);
  const action = firstAction(report);
  assert.equal(action.type, "fetch-primary");
  assert.equal(action.status, "success");

  const localized = await whatsNext({
    language: "zh-cn",
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(localized.observation.state, "navigation-ready");
  assert.equal(localized.observation.outputLanguage, "zh-CN");
  assert.equal(
    localized.response.summary,
    "当前状态：navigation-ready。当前有 1 个 active idea。",
  );
  assert.equal(
    configuration(localized).preferredLanguage,
    "en-US",
  );
  assert.match(responseText(localized), /^请明确选择/);
  assert.match(actionCommit(localized), /^[0-9a-f]{40}$/);
  assert.equal(Object.hasOwn(firstAction(localized), "summary"), false);
});

test("empty navigation stays ready without selecting an idea", async () => {
  const repository = await fixture({ ideas: [] });
  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, []);
  assert.equal(report.observation.ideas.counts.completed, 0);
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(renderResponse(report.response), /当前没有 active idea|No active ideas/);
  assert.match(responseText(report), /create-idea/);
});

test("navigation renders an alias-less idea without a level-one title", async () => {
  const repository = await fixture({
    ideas: [{ id: FIRST_ID, status: {} }],
  });
  const path = ideaPaths(FIRST_ID).ideaDocumentPath;
  await writeFile(join(repository.root, ...path.split("/")), "## Not a title\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Remove level-one title");
  git(repository.root, "push", "origin", "main");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });
  assert.deepEqual(choices(report), [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
  }]);
  assert.match(
    renderResponse(report.response, {
      now: new Date(Date.parse(ideaCreatedAt(FIRST_ID)) + 7 * 24 * 60 * 60_000),
    }),
    new RegExp(`\\| ${FIRST_ID} \\| preparing \\| 7d ago \\| - \\|`),
  );
});

test("resolves the repository root when invoked from a nested directory", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: nested,
    userHome: repository.base,
  });

  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.observation.selectedIdea.state, "preparing");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  assert.match(responseText(report), /event replay/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
});

test("default navigation excludes completed and abandoned ideas while counting them", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set lifecycle states");
  git(repository.root, "push", "origin", "main");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(ideas(report).counts, {
    preparing: 1,
    implementing: 1,
    deploying: 1,
    completed: 1,
    abandoned: 1,
  });
  assert.deepEqual(
    ideas(report).activeIdeas.map(({ id }) => id),
    [FIRST_ID, SECOND_ID, DEPLOYING_ID].sort(),
  );
  assert.doesNotMatch(responseText(report), new RegExp(COMPLETED_ID));
  assert.doesNotMatch(responseText(report), new RegExp(ABANDONED_ID));

  const lifecycleCases: ReadonlyArray<readonly [string, string]> = [
    [FIRST_ID, "acceptIdeal"],
    [SECOND_ID, "acceptInner"],
    [DEPLOYING_ID, "acceptOuter"],
    [COMPLETED_ID, "Review completed \\(completed\\)"],
    [ABANDONED_ID, "Review abandoned \\(abandoned\\)"],
  ];
  for (const [id, phrase] of lifecycleCases) {
    const selected = await whatsNext({
      idea: id,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.idea, id);
    assert.equal(selected.observation.state, "idea-selected");
    assert.equal(selected.observation.selectedIdea.id, id);
    assert.equal(Object.hasOwn(selected.observation, "ideas"), false);
    assert.match(responseText(selected), new RegExp(phrase));
  }
});

test("uses formal world and contract names in localized lifecycle instructions", async () => {
  const repository = await fixture({
    preferredLanguage: "fr-FR",
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set localized lifecycle states");
  git(repository.root, "push", "origin", "main");

  const localizedCases: ReadonlyArray<readonly [string, string]> = [
    [FIRST_ID, "acceptIdeal 人工决定"],
    [SECOND_ID, "acceptInner 人工决定"],
    [DEPLOYING_ID, "acceptOuter 人工决定"],
    [COMPLETED_ID, "复查 completed（completed）"],
    [ABANDONED_ID, "复查 abandoned（abandoned）"],
  ];
  for (const [id, phrase] of localizedCases) {
    const selected = await whatsNext({
      idea: id,
      language: "zh-cn",
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.language, "zh-CN");
    assert.equal(selected.observation.outputLanguage, "zh-CN");
    assert.equal(
      configuration(selected).preferredLanguage,
      "fr-FR",
    );
    assert.match(responseText(selected), new RegExp(phrase));
    assert.doesNotMatch(responseText(selected), /道心|内景|现世/);
    if ([FIRST_ID, SECOND_ID, DEPLOYING_ID].includes(id)) {
      assert.match(
        responseText(selected),
        /自然语言内容中使用 fr-FR/,
      );
    }
  }
});

test("[selector-unknown] reports an unknown selector without guessing", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    idea: "unknown",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.problems, []);
  assert.equal(report.observation.state, "idea-not-found");
  assert.deepEqual(report.observation.candidates, [{
    id: FIRST_ID,
    state: "preparing",
    createdAt: ideaCreatedAt(FIRST_ID),
    alias: "fixture",
    title: "Fixture",
  }]);
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(responseText(report), /未匹配/);
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /create-idea/);
});

test("[selector-known] [alias-absent] selects an alias-less idea only by explicit ULID", async () => {
  const repository = await fixture({
    ideas: [{ id: FIRST_ID, status: {} }],
  });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(
    Object.hasOwn(report.observation.selectedIdea, "alias"),
    false,
  );
  assert.match(responseText(report), new RegExp(FIRST_ID));
  assert.doesNotMatch(responseText(report), /undefined|\(\)/);
});

test("resolves preferred language for the selected idea without changing bare navigation", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr" },
    }],
  });

  const selected = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  const bare = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(
    configuration(selected).preferredLanguage,
    "fr",
  );
  assert.equal(selected.observation.outputLanguage, "en-US");
  assert.equal(
    configuration(bare).preferredLanguage,
    "en-US",
  );
  assert.equal(bare.observation.outputLanguage, "en-US");
});

test("uses a canonical output override without changing content language or persisted status", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr-FR" },
    }],
  });
  const statusPath = join(
    repository.root,
    ".silvermoon",
    "ideas",
    FIRST_ID,
    "events.jsonl",
  );
  const configPath = join(repository.root, ".silvermoon", "config.yaml");
  const before = await readFile(statusPath, "utf8");
  const configBefore = await readFile(configPath, "utf8");

  const selected = await whatsNext({
    idea: "localized",
    language: "ZH-cn",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(selected.intention.args, {
    idea: "localized",
    language: "zh-CN",
  });
  assert.equal(selected.observation.outputLanguage, "zh-CN");
  assert.equal(
    configuration(selected).preferredLanguage,
    "fr-FR",
  );
  assert.deepEqual(
    {
      contentLanguage: responseReview(selected).presentation.contentLanguage,
      templateLanguage: responseReview(selected).presentation.templateLanguage,
      requiresLocalization:
        responseReview(selected).presentation.requiresLocalization,
      gateLabel: responseReview(selected).presentation.gateLabel,
    },
    {
      contentLanguage: "fr-FR",
      templateLanguage: "en-US",
      requiresLocalization: true,
      gateLabel: "Ideal World approval",
    },
  );
  assert.match(
    responseReview(selected).presentation.decisionQuestion,
    /^Do you approve `idealRevision=[0-9a-f]{12}`/,
  );
  assert.match(responseText(selected), /^在 /);
  assert.match(responseText(selected), /requiresLocalization/);
  assert.match(responseText(selected), /自然语言内容中使用 fr-FR/);
  assert.match(actionCommit(selected), /^[0-9a-f]{40}$/);
  assert.equal(await readFile(statusPath, "utf8"), before);
  assert.equal(await readFile(configPath, "utf8"), configBefore);

  await writeFile(join(repository.root, "local.txt"), "preserve me\n");
  const blocked = await whatsNext({
    idea: "localized",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(blocked.observation.outputLanguage, "zh-CN");
  assert.match(responseText(blocked), /^检查全部 staged、unstaged 和 untracked 路径/);
  assert.match(
    responseText(blocked),
    /silvermoon whats-next "localized" --language zh-CN/,
  );
});

test("drives gate presentation from content language instead of output language", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "zh-CN" },
    }],
  });

  const selected = await whatsNext({
    idea: "localized",
    language: "en-US",
    root: repository.root,
    userHome: repository.base,
  });
  const presentation = responseReview(selected).presentation;

  assert.equal(selected.observation.outputLanguage, "en-US");
  assert.equal(configuration(selected).preferredLanguage, "zh-CN");
  assert.deepEqual(
    {
      contentLanguage: presentation.contentLanguage,
      templateLanguage: presentation.templateLanguage,
      requiresLocalization: presentation.requiresLocalization,
      gateLabel: presentation.gateLabel,
      candidateConnector: presentation.candidateConnector,
      labels: presentation.labels,
      documentLabels: presentation.documentLabels,
    },
    {
      contentLanguage: "zh-CN",
      templateLanguage: "zh-CN",
      requiresLocalization: false,
      gateLabel: "理想世界批准",
      candidateConnector: "位于 primary",
      labels: {
        idea: "构想",
        candidate: "候选版本",
        reviewFocus: "审阅重点",
        reviewFiles: "审阅文件",
        decision: "决定",
        local: "本地",
        remote: "线上",
      },
      documentLabels: {
        "current-contract": "构想契约",
        ledger: "执行清单",
      },
    },
  );
  assert.match(
    presentation.decisionQuestion,
    /^是否批准 `idealRevision=[0-9a-f]{12}` 作为该 IDEA 的理想世界？$/,
  );
  assert.match(responseText(selected), /^Continue /);
  assert.match(responseText(selected), /response\.review\.presentation/);

  const rendered = renderResponse(selected.response);
  assert.match(rendered, /### Review candidate/);
  assert.match(rendered, /#### Gate presentation/);
  assert.match(rendered, /"contentLanguage": "zh-CN"/);
  assert.match(rendered, /"gateLabel": "理想世界批准"/);
  assert.match(rendered, /"idea": "构想"/);
});

test("names Chinese review contracts by their canonical artifacts", async () => {
  const repository = await fixture({
    ideas: [
      {
        id: FIRST_ID,
        status: { alias: "idea-contract", language: "zh-CN" },
      },
      {
        id: SECOND_ID,
        status: { alias: "implementation-contract", language: "zh-CN" },
      },
      {
        id: DEPLOYING_ID,
        status: { alias: "deployment-contract", language: "zh-CN" },
      },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementation-contract",
    language: "zh-CN",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deployment-contract",
    language: "zh-CN",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set localized review phases");
  git(repository.root, "push", "origin", "main");

  const cases = [
    {
      selector: "idea-contract",
      gateLabel: "理想世界批准",
      contractLabel: "构想契约",
      question: /作为该 IDEA 的理想世界？$/,
    },
    {
      selector: "implementation-contract",
      gateLabel: "实现验收",
      contractLabel: "实现契约",
      question: /作为该 IDEA 的实现？$/,
    },
    {
      selector: "deployment-contract",
      gateLabel: "现实世界验收",
      contractLabel: "部署契约",
      question: /作为该 IDEA 的现实世界结果？$/,
    },
  ] as const;

  for (const expected of cases) {
    const report = await whatsNext({
      idea: expected.selector,
      language: "en-US",
      root: repository.root,
      userHome: repository.base,
    });
    const presentation = responseReview(report).presentation;

    assert.equal(report.observation.outputLanguage, "en-US");
    assert.equal(presentation.contentLanguage, "zh-CN");
    assert.equal(presentation.gateLabel, expected.gateLabel);
    assert.equal(
      presentation.documentLabels["current-contract"],
      expected.contractLabel,
    );
    assert.match(presentation.decisionQuestion, expected.question);
  }
});
