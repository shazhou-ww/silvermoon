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

export function phaseGuidancePath(phase) {
  const path = PHASE_GUIDANCE_PATHS[phase];
  if (path === undefined) {
    throw new TypeError(`Unsupported guidance phase: ${String(phase)}`);
  }
  return path;
}

export function ideaPaths(id) {
  const ideaPath = `${IDEAS_ROOT}/${id}`;
  const outerPath = `${ideaPath}/outer`;
  const innerPath = `${outerPath}/inner`;
  const idealPath = `${innerPath}/ideal`;
  return {
    ideaPath,
    statusPath: `${ideaPath}/status.yaml`,
    eventsPath: `${ideaPath}/events.jsonl`,
    ledgerPath: `${ideaPath}/ledger.md`,
    outerPath,
    deploymentDocumentPath: `${outerPath}/Deployment.md`,
    innerPath,
    implementationDocumentPath: `${innerPath}/Implementation.md`,
    idealPath,
    ideaDocumentPath: `${idealPath}/Idea.md`,
  };
}
