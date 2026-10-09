/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * Used when navigation metadata cannot be read for observed active ideas.
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
const ideaMetadataUnavailable = ({
  command,
  message,
}: MetadataUnavailableParameters) =>
  ({
    summary: message,
    nextSteps: `Repair the reported idea document and retry \`${command}\`.`,
  });

export default ideaMetadataUnavailable;
