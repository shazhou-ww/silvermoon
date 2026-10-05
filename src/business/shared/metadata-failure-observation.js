import { localize } from "../../foundation/language/index.js";

export function metadataFailureObservation(observed, caught, command) {
  const { ideas: _ideas, ...base } = observed.observation;
  const problem = {
    type: "idea-metadata-unavailable",
    summary: localize(
      observed.outputLanguage,
      caught.message,
      `无法读取 idea metadata：${caught.message}`,
    ),
  };
  return {
    observation: {
      ...base,
      state: "project-setup-required",
      observedThrough: "configuration",
      problems: [problem],
    },
    responseContext: {
      nextSteps: localize(
        observed.outputLanguage,
        `Repair the reported idea document and retry \`${command}\`.`,
        `修复报告的 idea document 后，重新运行 \`${command}\`。`,
      ),
    },
  };
}
