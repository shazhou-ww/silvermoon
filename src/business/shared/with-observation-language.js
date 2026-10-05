import { resolvedConfiguration } from "../../foundation/report/index.js";
import { resolveLanguage, resolveOutputLanguage } from "../../foundation/language/index.js";

export function withObservationLanguage(observed, ideaLanguage) {
  if (!observed.config || !ideaLanguage) return observed;
  const contentLanguage = resolveLanguage({ idea: ideaLanguage }).tag;
  const outputLanguage = resolveOutputLanguage({
    content: contentLanguage,
    override: observed.outputLanguageOverride,
  }).tag;
  const observation = {
    ...observed.observation,
    configuration: resolvedConfiguration(observed.config, contentLanguage),
    outputLanguage,
  };
  return { ...observed, contentLanguage, observation, outputLanguage };
}
