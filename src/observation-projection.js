/** @pure */
export function projectObservation({
  configuration,
  ideas,
  outputLanguage,
  problems,
  root,
  version,
}) {
  if (version === undefined) {
    return {
      state: "project-setup-required",
      observedThrough: "root",
      root,
      outputLanguage,
      problems,
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
  };
}

/** @pure */
export function incompleteObservation({
  configuration,
  ideas,
  outputLanguage,
  problem,
  root,
  version,
}) {
  return projectObservation({
    configuration,
    ideas,
    outputLanguage,
    problems: [problem],
    root,
    version,
  });
}

/** @pure */
export function unavailableObservation({
  outputLanguage,
  root,
  version,
  problem,
}) {
  return {
    state: "check-unavailable",
    root,
    version,
    outputLanguage,
    problems: [problem],
  };
}

/** @pure */
export function repositoryProblemObservation(observation, problems) {
  return {
    ...observation,
    state: "repository-sync-required",
    problems,
  };
}
