import { renderIdeaMetadataUnavailable } from "../../foundation/report/index.ts";
import type { ProjectSetupObservation } from "../../foundation/report/types.ts";
import type { ReadyObservation } from "./business-types.ts";

export function metadataFailureObservation(
  observed: ReadyObservation,
  caught: unknown,
  command: string,
) {
  const message = caught instanceof Error ? caught.message : String(caught);
  const rendered = renderIdeaMetadataUnavailable(
    observed.outputLanguage,
    { command, message },
  );
  const problem = {
    type: "idea-metadata-unavailable",
    summary: rendered.summary,
  };
  return {
    observation: {
      state: "project-setup-required",
      root: observed.observation.root,
      version: observed.observation.version,
      configuration: observed.observation.configuration,
      ...(observed.observation.device === undefined
        ? {}
        : { device: observed.observation.device }),
      ...(observed.observation.schemas === undefined
        ? {}
        : { schemas: observed.observation.schemas }),
      outputLanguage: observed.observation.outputLanguage,
      observedThrough: "configuration",
      problems: [problem],
    } satisfies ProjectSetupObservation,
    responseContext: {
      nextSteps: rendered.nextSteps,
    },
  };
}
