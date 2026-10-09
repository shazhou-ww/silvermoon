/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * Used when navigation metadata cannot be read for observed active ideas.
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
export default function ideaMetadataUnavailable({
  command,
  message,
}: MetadataUnavailableParameters) {
  return {
    summary: message,
    nextSteps: `Repair the reported idea document and retry \`${command}\`.`,
  };
}
