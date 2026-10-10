/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * Used when navigation metadata cannot be read for observed active ideas.
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
const ideaMetadataUnavailable = ({
  command,
  documentPath,
  message,
}: MetadataUnavailableParameters) =>
  ({
    summary: message,
    nextSteps: documentPath === undefined
      ? `Repair the reported idea document and retry \`${command}\`.`
      : [
        `Restore ${documentPath} as the current idea's canonical Idea.md.`,
        `Use this canonical template:`,
        "```markdown",
        "# <title>",
        "",
        "## Problem",
        "",
        "## Outcome",
        "",
        "## Boundaries",
        "",
        "## Acceptance criteria",
        "```",
        `Then retry \`${command}\`.`,
      ].join("\n"),
  });

export default ideaMetadataUnavailable;
