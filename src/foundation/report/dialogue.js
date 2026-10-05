import { localize } from "../language/index.js";
import { ACTIVE_IDEA_STATES, IDEA_STATES } from "../idea-model/index.js";

const ACTIVE_STATES = new Set(ACTIVE_IDEA_STATES);

/** @pure */
export function diagnosticProblem(diagnostic, language = "en-US") {
  const location = diagnostic.path ? ` (${diagnostic.path})` : "";
  return {
    type: diagnostic.code.replaceAll(".", "-"),
    summary: localize(
      language,
      `${diagnostic.message}${location}`.trim(),
      diagnostic.path
        ? `在 ${diagnostic.path} 发现 ${diagnostic.code}：${diagnostic.message}`
        : `发现 ${diagnostic.code}：${diagnostic.message}`,
    ),
  };
}

/** @pure */
export function diagnosticInstruction(diagnostic, language = "en-US") {
  return localize(
    language,
    diagnostic.remediation,
    diagnostic.path
      ? `修复 ${diagnostic.path} 的 ${diagnostic.code}：${diagnostic.remediation}`
      : `修复 ${diagnostic.code}：${diagnostic.remediation}`,
  );
}

export function summarizeIdeas(ideas) {
  const counts = Object.fromEntries(IDEA_STATES.map((state) => [state, 0]));
  const activeIdeas = [];
  for (const idea of ideas) {
    counts[idea.state] += 1;
    if (ACTIVE_STATES.has(idea.state)) {
      const reference = { id: idea.id, state: idea.state };
      if (idea.alias !== undefined) reference.alias = idea.alias;
      activeIdeas.push(reference);
    }
  }
  activeIdeas.sort((left, right) => left.id.localeCompare(right.id));
  return { counts, activeIdeas };
}

/** @pure */
export function resolvedConfiguration(config, preferredLanguage) {
  return {
    primaryRepository: config.primaryRepository,
    primaryBranch: config.primaryBranch,
    preferredLanguage,
  };
}

/** @pure */
export function dialogueReadyObservation(observation, state, details = {}) {
  const { root, version, configuration, outputLanguage, problems } = observation;
  return {
    state,
    root,
    version,
    configuration,
    outputLanguage,
    problems,
    ...details,
  };
}

export { ACTIVE_STATES, IDEA_STATES, localize };
