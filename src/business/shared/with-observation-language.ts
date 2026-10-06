import { resolvedConfiguration } from "../../foundation/report/index.ts";
import { resolveLanguage, resolveOutputLanguage } from "../../foundation/language/index.ts";
import type { ReadyObservation } from "./business-types.ts";

export function withObservationLanguage(
  observed: ReadyObservation,
  ideaLanguage: string | undefined,
): ReadyObservation {
  if (!observed.config || !ideaLanguage) return observed;
  const contentLanguage = resolveLanguage({ idea: ideaLanguage }).tag;
  const outputLanguage = resolveOutputLanguage({
    content: contentLanguage,
    ...(observed.outputLanguageOverride === undefined
      ? {}
      : { override: observed.outputLanguageOverride }),
  }).tag;
  const observation = {
    ...observed.observation,
    configuration: resolvedConfiguration(observed.config, contentLanguage),
    outputLanguage,
  };
  return { ...observed, contentLanguage, observation, outputLanguage };
}
