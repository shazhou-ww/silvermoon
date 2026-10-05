import { eventsFromStatus, serializeIdeaEvents } from "../event-codec/index.js";
import { ideaTemplates } from "../idea-template/index.js";
import { serializeIdeaStatus } from "../idea-model/index.js";
import { ideaPaths } from "../coordinates/index.js";

/** @pure */
export function buildIdeaScaffold({ id, canonicalLanguage, contentLanguage, formatVersion }) {
  const paths = ideaPaths(id);
  const templates = ideaTemplates(contentLanguage);
  const status = {
    version: 1,
    id,
    ...(canonicalLanguage === undefined ? {} : { language: canonicalLanguage }),
  };
  return {
    directoryPaths: [
      paths.ideaPath,
      ...(formatVersion >= 2 ? [paths.eventsDirectory] : []),
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
        ? serializeIdeaEvents(eventsFromStatus(status))
        : serializeIdeaStatus(status)],
    ],
  };
}
