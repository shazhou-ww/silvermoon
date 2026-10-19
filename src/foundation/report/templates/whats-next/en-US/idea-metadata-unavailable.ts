/**
 * @template idea-metadata-unavailable
 * @when idea.navigationMetadata=unavailable
 * Used when navigation metadata cannot be read for observed active ideas.
 */
import type { MetadataUnavailableParameters } from "../contract.ts";

/** @pure */
const ideaMetadataUnavailable = ({
  documentPath,
  message,
}: MetadataUnavailableParameters) =>
  ({
    summary: message,
    nextSteps: documentPath === undefined
      ? "The goal is a readable canonical Idea.md that satisfies the idea metadata contract."
      : [
        `The goal is for ${documentPath} to be the current idea's readable canonical Idea.md.`,
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
      ].join("\n"),
  });

export default ideaMetadataUnavailable;
