import type {
  IdeaSummary,
  Observation,
  Problem,
  ProjectConfiguration,
  ProjectVersion,
} from "./types.ts";

interface ProjectObservationInput {
  configuration?: ProjectConfiguration;
  device?: import("./types.ts").DeviceAdvisory;
  ideas?: IdeaSummary;
  outputLanguage: string;
  problems: Problem[];
  root: string;
  schemas?: import("../schema-capability/index.ts").ProjectSchemaReadiness;
  version?: ProjectVersion;
}

/** @pure */
export function projectObservation({
  configuration,
  device,
  ideas,
  outputLanguage,
  problems,
  root,
  schemas,
  version,
}: ProjectObservationInput): Observation {
  if (version === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "root",
      root,
      outputLanguage,
      problems,
      ...(device === undefined ? {} : { device }),
      ...(schemas === undefined ? {} : { schemas }),
    };
  }
  if (configuration === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "version",
      root,
      version,
      outputLanguage,
      problems,
      ...(device === undefined ? {} : { device }),
      ...(schemas === undefined ? {} : { schemas }),
    };
  }
  if (ideas === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "configuration",
      root,
      version,
      configuration,
      outputLanguage,
      problems,
      ...(device === undefined ? {} : { device }),
      ...(schemas === undefined ? {} : { schemas }),
    };
  }
  return {
    state: "project-setup-required",
    observedThrough: "ideas",
    root,
    version,
    configuration,
    ideas,
    outputLanguage,
    problems,
    ...(device === undefined ? {} : { device }),
    ...(schemas === undefined ? {} : { schemas }),
  };
}

/** @pure */
export function incompleteObservation({
  configuration,
  device,
  ideas,
  outputLanguage,
  problem,
  root,
  schemas,
  version,
}: Omit<ProjectObservationInput, "problems"> & { problem: Problem }): Observation {
  return projectObservation({
    ...(configuration === undefined ? {} : { configuration }),
    ...(device === undefined ? {} : { device }),
    ...(ideas === undefined ? {} : { ideas }),
    outputLanguage,
    problems: [problem],
    root,
    ...(schemas === undefined ? {} : { schemas }),
    ...(version === undefined ? {} : { version }),
  });
}

/** @pure */
export function unavailableObservation({
  outputLanguage,
  root,
  version,
  problem,
}: {
  outputLanguage: string;
  root: string;
  version?: ProjectVersion;
  problem: Problem;
}): Observation {
  return {
    state: "check-unavailable",
    root,
    ...(version === undefined ? {} : { version }),
    outputLanguage,
    problems: [problem],
  };
}

/** @pure */
export function repositoryProblemObservation<Source extends Observation>(
  observation: Source,
  problems: Problem[],
) {
  return {
    ...observation,
    state: "repository-sync-required",
    problems,
  };
}
