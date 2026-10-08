import { serializeIdeaEvents } from "../event-codec/index.ts";
import { ideaTemplates } from "../idea-template/index.ts";
import { serializeIdeaStatus } from "../idea-model/index.ts";
import { ideaPaths } from "../coordinates/index.ts";

/** @pure */
export function buildIdeaScaffold({
  id,
  canonicalLanguage,
  contentLanguage,
  formatVersion,
}: {
  id: string;
  canonicalLanguage?: string;
  contentLanguage: string;
  formatVersion: number;
}) {
  const paths = ideaPaths(id);
  const templates = ideaTemplates(contentLanguage);
  const status = {
    version: 1,
    id,
    ...(canonicalLanguage === undefined ? {} : { language: canonicalLanguage }),
  };
  const events = canonicalLanguage === undefined
    ? []
    : [{ sequence: 1, type: "setLanguage", payload: { language: canonicalLanguage } }];
  const serializedStatus = serializeIdeaStatus(status);
  return {
    directoryPaths: [
      paths.ideaPath,
      paths.outerPath,
      paths.innerPath,
      paths.idealPath,
    ],
    files: [
      [paths.ideaDocumentPath, templates.idea],
      [paths.implementationDocumentPath, templates.implementation],
      [paths.deploymentDocumentPath, templates.deployment],
      [paths.ledgerPath, templates.ledger],
      [formatVersion >= 2 ? paths.eventsPath : paths.statusPath, formatVersion >= 2
        ? serializeIdeaEvents(events)
        : serializedStatus],
    ],
  };
}
