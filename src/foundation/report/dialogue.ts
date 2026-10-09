import { localize } from "../language/index.ts";
import { ACTIVE_IDEA_STATES, IDEA_STATES } from "../idea-model/index.ts";
import type {
  Diagnostic,
  IdeaCounts,
  IdeaReference,
  Problem,
  ProjectConfiguration,
  ProjectVersion,
} from "./types.ts";

const ACTIVE_STATES: ReadonlySet<string> = new Set(ACTIVE_IDEA_STATES);

/** @pure */
export function diagnosticProblem(diagnostic: Diagnostic, language = "en-US"): Problem {
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
export function diagnosticInstruction(
  diagnostic: Diagnostic & { remediation: string },
  language = "en-US",
) {
  return localize(
    language,
    diagnostic.remediation,
    diagnostic.path
      ? `修复 ${diagnostic.path} 的 ${diagnostic.code}：${diagnostic.remediation}`
      : `修复 ${diagnostic.code}：${diagnostic.remediation}`,
  );
}

export function summarizeIdeas(ideas: IdeaReference[]) {
  const counts: IdeaCounts = Object.fromEntries(
    IDEA_STATES.map((state) => [state, 0]),
  );
  const activeIdeas: IdeaReference[] = [];
  for (const idea of ideas) {
    counts[idea.state] = (counts[idea.state] ?? 0) + 1;
    if (ACTIVE_STATES.has(idea.state)) {
      const reference: IdeaReference = { id: idea.id, state: idea.state };
      if (idea.alias !== undefined) reference.alias = idea.alias;
      activeIdeas.push(reference);
    }
  }
  activeIdeas.sort((left, right) => left.id.localeCompare(right.id));
  return { counts, activeIdeas };
}

/** @pure */
export function resolvedConfiguration(
  config: Pick<ProjectConfiguration, "primaryRepository" | "primaryBranch">,
  preferredLanguage?: string,
): ProjectConfiguration {
  return {
    primaryRepository: config.primaryRepository,
    primaryBranch: config.primaryBranch,
    ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
  };
}

/** @pure */
export function dialogueReadyObservation<
  State extends string,
  Details extends object = Record<never, never>,
>(
  observation: {
    root: string;
    version: ProjectVersion;
    configuration: ProjectConfiguration;
    device?: import("./types.ts").DeviceAdvisory;
    schemas?: import("../schema-capability/index.ts").ProjectSchemaReadiness;
    outputLanguage: string;
    problems: Problem[];
  },
  state: State,
  details?: Details,
) {
  const {
    root,
    version,
    configuration,
    device,
    schemas,
    outputLanguage,
    problems,
  } = observation;
  return {
    state,
    root,
    version,
    configuration,
    outputLanguage,
    problems,
    ...(device === undefined ? {} : { device }),
    ...(schemas === undefined ? {} : { schemas }),
    ...details,
  };
}

export { ACTIVE_STATES, IDEA_STATES, localize };
