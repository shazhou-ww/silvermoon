import { localize } from "../../foundation/language/index.ts";
import type { ProjectSetupObservation } from "../../foundation/report/types.ts";
import type { ReadyObservation } from "./business-types.ts";

export function metadataFailureObservation(
  observed: ReadyObservation,
  caught: unknown,
  command: string,
) {
  const message = caught instanceof Error ? caught.message : String(caught);
  const problem = {
    type: "idea-metadata-unavailable",
    summary: localize(
      observed.outputLanguage,
      message,
      `无法读取 idea metadata：${message}`,
    ),
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
      nextSteps: localize(
        observed.outputLanguage,
        `Repair the reported idea document and retry \`${command}\`.`,
        `修复报告的 idea document 后，重新运行 \`${command}\`。`,
      ),
    },
  };
}
