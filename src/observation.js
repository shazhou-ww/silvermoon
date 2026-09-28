import { inspectAdoption } from "./adoption.js";
import {
  diagnosticInstruction,
  diagnosticProblem,
  localize,
  resolvedConfiguration,
  summarizeIdeas,
} from "./dialogue.js";
import { inspectIdeaLayout } from "./idea-layout.js";
import { resolveLanguage } from "./language.js";
import { traceAsync } from "./trace.js";
import { loadUserConfig } from "./user-config.js";

function projectObservation({
  configuration,
  ideas,
  problems,
  root,
  version,
}) {
  if (version === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "root",
      root,
      problems,
    };
  }
  if (configuration === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "version",
      root,
      version,
      problems,
    };
  }
  if (ideas === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "configuration",
      root,
      version,
      configuration,
      problems,
    };
  }
  return {
    state: "project-setup-required",
    observedThrough: "ideas",
    root,
    version,
    configuration,
    ideas,
    problems,
  };
}

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

export function incompleteObservation({
  configuration,
  ideas,
  problem,
  root,
  version,
}) {
  return projectObservation({
    configuration,
    ideas,
    problems: [problem],
    root,
    version,
  });
}

export function repositoryProblemObservation(observation, problems) {
  return {
    ...observation,
    state: "repository-sync-required",
    problems,
  };
}

async function observeSnapshotInternal({
  allowMissingIdeas = false,
  baseRevision,
  contentRoot,
  gitRoot,
  historyCommit,
  ideaLanguage,
  root,
  snapshotTree,
  userHome,
  validateCandidate = false,
  version,
}) {
  const adoption = await traceAsync(
    "adoption.inspect",
    {},
    () => inspectAdoption({ contentRoot, root }),
  );
  const user = await traceAsync(
    "user-config.load",
    {},
    () => loadUserConfig({ home: userHome }),
  );
  const userFindings = user.diagnostics.map((diagnostic) => ({
    priority: 30,
    problem: diagnosticProblem(diagnostic),
    instruction: diagnostic.remediation,
    sourceDiagnostic: diagnostic,
  }));
  const baseFindings = [...adoption.findings, ...userFindings]
    .sort((left, right) => left.priority - right.priority);
  const fallbackLanguage = resolveLanguage({
    global: user.config?.preferredLanguage,
  }).tag;

  if (!adoption.gitReady) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackLanguage)
    );
    const observation = projectObservation({
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
    });
    return {
      config: null,
      findings,
      language: fallbackLanguage,
      layout: null,
      observation,
      projectReady: false,
    };
  }

  if (!adoption.config) {
    const findings = baseFindings.map((finding) =>
      localizeFinding(finding, fallbackLanguage)
    );
    const observation = projectObservation({
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: null,
      findings,
      language: fallbackLanguage,
      layout: null,
      observation,
      projectReady: false,
    };
  }

  const language = resolveLanguage({
    idea: ideaLanguage,
    project: adoption.config.preferredLanguage,
    global: user.config?.preferredLanguage,
  }).tag;
  const configuration = resolvedConfiguration(adoption.config, language);
  const findings = baseFindings.map((finding) =>
    localizeFinding(finding, language)
  );
  let layout;
  try {
    layout = await traceAsync(
      "idea-layout.inspect",
      {},
      () => inspectIdeaLayout({
        baseRevision,
        config: adoption.config,
        gitRoot: gitRoot ?? adoption.root,
        historyCommit,
        root: contentRoot ?? adoption.root,
        snapshotTree,
        validateCandidate,
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

  const layoutFindings = layout.diagnostics.map((diagnostic) => ({
    priority: 50,
    problem: diagnosticProblem(diagnostic, language),
    instruction: diagnosticInstruction(diagnostic, language),
  }));
  findings.push(...layoutFindings);
  findings.sort((left, right) => left.priority - right.priority);

  if (layout.diagnostics.length > 0) {
    const observation = projectObservation({
      configuration,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: adoption.config,
      findings,
      language,
      layout,
      observation,
      projectReady: false,
    };
  }

  const ideas = summarizeIdeas(layout.ideas);
  if (findings.length > 0) {
    const observation = projectObservation({
      configuration,
      ideas,
      problems: findings.map(({ problem }) => problem),
      root: adoption.root,
      version,
    });
    return {
      config: adoption.config,
      findings,
      language,
      layout,
      observation,
      projectReady: false,
    };
  }

  return {
    config: adoption.config,
    findings,
    language,
    layout,
    observation: {
      state: ideas.activeIdeas.length > 0 ? "task-pending" : "idle",
      root: adoption.root,
      version,
      configuration,
      ideas,
      problems: [],
    },
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

export function withObservationLanguage(observed, ideaLanguage) {
  if (!observed.config || !ideaLanguage) return observed;
  const language = resolveLanguage({ idea: ideaLanguage }).tag;
  const observation = {
    ...observed.observation,
    configuration: resolvedConfiguration(observed.config, language),
  };
  return { ...observed, language, observation };
}
