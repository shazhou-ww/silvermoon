export const METADATA_ROOT = ".silvermoon";
export const CONFIG_PATH = `${METADATA_ROOT}/config.yaml`;
export const IDEAS_ROOT = `${METADATA_ROOT}/ideas`;
export const GUIDANCE_ROOT = `${METADATA_ROOT}/guidance`;
export const PHASE_GUIDANCE_PATHS = Object.freeze({
  preparing: `${GUIDANCE_ROOT}/preparing.md`,
  implementing: `${GUIDANCE_ROOT}/implementing.md`,
  deploying: `${GUIDANCE_ROOT}/deploying.md`,
});
export const GUIDANCE_PHASES = Object.freeze(
  Object.keys(PHASE_GUIDANCE_PATHS),
);
export type GuidancePhase = keyof typeof PHASE_GUIDANCE_PATHS;

/** @pure */
function isGuidancePhase(phase: string): phase is GuidancePhase {
  return Object.hasOwn(PHASE_GUIDANCE_PATHS, phase);
}

/** @pure */
export function phaseGuidancePath(phase: string | undefined) {
  if (phase === undefined || !isGuidancePhase(phase)) {
    throw new TypeError(`Unsupported guidance phase: ${String(phase)}`);
  }
  return PHASE_GUIDANCE_PATHS[phase];
}

/** @pure */
export function ideaPaths(id: string) {
  const ideaPath = `${IDEAS_ROOT}/${id}`;
  const outerPath = `${ideaPath}/outer`;
  const innerPath = `${outerPath}/inner`;
  const idealPath = `${innerPath}/ideal`;
  return {
    ideaPath,
    statusPath: `${ideaPath}/status.yaml`,
    eventsDirectory: `${ideaPath}/events`,
    eventsPath: `${ideaPath}/events/0000000000000001.jsonl`,
    legacyEventsPath: `${ideaPath}/events.jsonl`,
    ledgerPath: `${ideaPath}/ledger.md`,
    outerPath,
    deploymentDocumentPath: `${outerPath}/Deployment.md`,
    innerPath,
    implementationDocumentPath: `${innerPath}/Implementation.md`,
    idealPath,
    ideaDocumentPath: `${idealPath}/Idea.md`,
  };
}
