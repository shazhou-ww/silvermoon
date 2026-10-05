import { diagnosticInstruction, diagnosticProblem, resolvedConfiguration, summarizeIdeas } from "../../foundation/report/index.js";
import { localize } from "../../foundation/language/index.js";
import { inspectAllGuidance } from "../../foundation/guidance/index.js";
import { observeDevice } from "./observe-device.js";
import { observeIdea } from "./observe-idea.js";
import { observeProject } from "./observe-project.js";
import { resolveLanguage, resolveOutputLanguage } from "../../foundation/language/index.js";
import { projectObservation } from "../../foundation/report/index.js";
import { traceAsync } from "../../foundation/trace/index.js";

function localizeFinding(finding, language) {
  if (finding.sourceDiagnostic) {
    return {
      priority: finding.priority,
      problem: diagnosticProblem(finding.sourceDiagnostic, language),
      instruction: diagnosticInstruction(finding.sourceDiagnostic, language),
    };
  }
  return {
    priority: finding.priority,
    problem: {
      type: finding.problem.type,
      summary: localize(
        language,
        finding.problem.summary,
        `Silvermoon 发现 ${finding.problem.type}：${finding.problem.summary}`,
      ),
    },
    instruction: localize(
      language,
      finding.instruction,
      `处理 ${finding.problem.type}：${finding.instruction}`,
    ),
  };
}

async function observeSnapshotInternal({
  allowMissingIdeas = false,
  contentRoot,
  filesystem,
  gitRoot,
  ideaLanguage,
  outputLanguage: requestedOutputLanguage,
  projectOnly = false,
  root,
  snapshotTree,
  userHome,
  version,
}) {
  const outputLanguageOverride = requestedOutputLanguage === undefined
    ? undefined
    : resolveOutputLanguage({ override: requestedOutputLanguage }).tag;
  const device = await traceAsync(
    "device.observe",
    {},
    () => observeDevice({ userHome }),
  );
  const adoption = await traceAsync(
    "project.observe",
    {},
    () => observeProject({
      contentRoot,
      device,
      filesystem,
      gitRoot,
      root,
    }),
  );
  const user = device.user;
  const userFindings = user.diagnostics.map((diagnostic) => ({
    priority: 30,
    problem: diagnosticProblem(diagnostic),
    instruction: diagnostic.remediation,
    sourceDiagnostic: diagnostic,
  }));
  const baseFindings = [...adoption.findings, ...userFindings]
    .sort((left, right) => left.priority - right.priority);
  const fallbackContentLanguage = resolveLanguage({
    global: user.config?.preferredLanguage,
  }).tag;
  const fallbackOutputLanguage = resolveOutputLanguage({
    content: fallbackContentLanguage,
    override: outputLanguageOverride,
  }).tag;

  if (!adoption.gitReady) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackOutputLanguage)
    );
    const observation = projectObservation({
      outputLanguage: fallbackOutputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
    });
    return {
      config: null,
      contentLanguage: fallbackContentLanguage,
      findings,
      layout: null,
      observation,
      outputLanguage: fallbackOutputLanguage,
      outputLanguageOverride,
      projectReady: false,
    };
  }

  if (!adoption.config) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackOutputLanguage)
    );
    const observation = projectObservation({
      outputLanguage: fallbackOutputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: null,
      contentLanguage: fallbackContentLanguage,
      findings,
      layout: null,
      observation,
      outputLanguage: fallbackOutputLanguage,
      outputLanguageOverride,
      projectReady: false,
    };
  }

  const contentLanguage = resolveLanguage({
    idea: ideaLanguage,
    project: adoption.config.preferredLanguage,
    global: user.config?.preferredLanguage,
  }).tag;
  const outputLanguage = resolveOutputLanguage({
    content: contentLanguage,
    override: outputLanguageOverride,
  }).tag;
  const configuration = resolvedConfiguration(adoption.config, contentLanguage);
  const findings = baseFindings.map((finding) =>
    localizeFinding(finding, outputLanguage)
  );
  let layout;
  try {
    layout = await traceAsync(
      "idea-layout.inspect",
      {},
      () => observeIdea({
        config: adoption.config,
        filesystem,
        gitRoot: gitRoot ?? adoption.root,
        project: adoption,
        root: contentRoot ?? adoption.root,
        snapshotTree,
      }),
    );
  } catch (caught) {
    layout = {
      diagnostics: [{
        code: "layout.inspection-failed",
        level: "error",
        message: `Cannot inspect Silvermoon ideas: ${caught.message}`,
        remediation: "Repair the ideas directory and retry.",
      }],
      ideas: [],
    };
  }
  if (allowMissingIdeas) {
    layout.diagnostics = layout.diagnostics.filter(
      ({ code }) => code !== "layout.ideas.missing",
    );
  }

  const guidanceDiagnostics = projectOnly
    ? (await inspectAllGuidance({
      filesystem,
      gitRoot: gitRoot ?? adoption.root,
      snapshotTree,
    })).diagnostics
    : [];
  const layoutFindings = layout.diagnostics.map((diagnostic) => ({
    priority: 50,
    problem: diagnosticProblem(diagnostic, outputLanguage),
    instruction: diagnosticInstruction(diagnostic, outputLanguage),
  }));
  const guidanceFindings = guidanceDiagnostics.map((diagnostic) => ({
    priority: 60,
    problem: diagnosticProblem(diagnostic, outputLanguage),
    instruction: diagnosticInstruction(diagnostic, outputLanguage),
  }));
  findings.push(...layoutFindings, ...guidanceFindings);
  findings.sort((left, right) => left.priority - right.priority);

  if (layout.diagnostics.length > 0) {
    const observation = projectObservation({
      configuration,
      outputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: adoption.config,
      contentLanguage,
      findings,
      layout,
      observation,
      outputLanguage,
      outputLanguageOverride,
      projectReady: false,
    };
  }

  const ideas = summarizeIdeas(layout.ideas);
  if (findings.length > 0) {
    const observation = projectObservation({
      configuration,
      ideas,
      outputLanguage,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: adoption.config,
      contentLanguage,
      findings,
      layout,
      observation,
      outputLanguage,
      outputLanguageOverride,
      projectReady: false,
    };
  }

  return {
    config: adoption.config,
    contentLanguage,
    findings,
    layout,
    observation: {
      state: projectOnly
        ? "project-ready"
        : ideas.activeIdeas.length > 0 ? "task-pending" : "idle",
      root: adoption.root,
      version,
      configuration,
      ideas,
      outputLanguage,
      problems: [],
    },
    outputLanguage,
    outputLanguageOverride,
    projectReady: true,
  };
}

export async function observeSnapshot(options) {
  return traceAsync(
    "snapshot.observe",
    {},
    () => observeSnapshotInternal(options),
  );
}
