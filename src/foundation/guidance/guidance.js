import { contentSizeDiagnostic, error, inspectContent, invalidDirectory, invalidFile, unexpectedEntry } from "./rules.js";
export { MAX_PHASE_GUIDANCE_BYTES } from "./rules.js";

import { inspectTree, readGitBlobs } from "../git/index.js";
import { GUIDANCE_PHASES, GUIDANCE_ROOT, phaseGuidancePath } from "../coordinates/index.js";
import { traceAsync } from "../trace/index.js";

const REGULAR_FILE_MODES = new Set(["100644", "100755"]);

async function inspectGuidanceInternal({
  filesystem,
  gitRoot,
  phase,
  snapshotTree,
}) {
  const treeEntries = filesystem === undefined
    ? inspectTree(gitRoot, snapshotTree, GUIDANCE_ROOT)
    : null;
  const rootEntry = treeEntries === null
    ? filesystem.snapshotEntry(GUIDANCE_ROOT)
    : treeEntries.find(({ name }) => name === GUIDANCE_ROOT);
  if (rootEntry === undefined) {
    return { state: "absent", diagnostics: [] };
  }
  if (rootEntry === null) {
    return { state: "absent", diagnostics: [] };
  }
  if (rootEntry.type !== "tree" || rootEntry.mode !== "040000") {
    return { state: "invalid", diagnostics: [invalidDirectory()] };
  }

  const prefix = `${GUIDANCE_ROOT}/`;
  const entries = (
    treeEntries === null
      ? filesystem.snapshotEntries(GUIDANCE_ROOT)
      : treeEntries.filter(({ name }) =>
        name.startsWith(prefix) && !name.slice(prefix.length).includes("/")
      )
  )
    .map((entry) => ({ ...entry, name: entry.name.slice(prefix.length) }));
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const phases = phase === undefined ? GUIDANCE_PHASES : [phase];
  const diagnostics = [];

  if (phase === undefined) {
    const allowedNames = new Set(
      GUIDANCE_PHASES.map((candidate) =>
        phaseGuidancePath(candidate).slice(`${GUIDANCE_ROOT}/`.length)
      ),
    );
    for (const entry of entries) {
      if (!allowedNames.has(entry.name)) {
        diagnostics.push(unexpectedEntry(entry.name));
      }
    }
  }

  let selectedGuidance;
  let selectedPresent = false;
  const contentEntries = [];
  for (const candidate of phases) {
    const path = phaseGuidancePath(candidate);
    const name = path.slice(`${GUIDANCE_ROOT}/`.length);
    const entry = entriesByName.get(name);
    if (entry === undefined) continue;
    selectedPresent = true;
    if (entry.type !== "blob" || !REGULAR_FILE_MODES.has(entry.mode)) {
      diagnostics.push(invalidFile(path));
      continue;
    }
    const sizeDiagnostic = contentSizeDiagnostic(entry, candidate);
    if (sizeDiagnostic) {
      diagnostics.push(sizeDiagnostic);
      continue;
    }
    contentEntries.push({ candidate, entry });
  }

  const blobs = filesystem === undefined
    ? readGitBlobs(
      gitRoot,
      contentEntries.map(({ entry }) => entry.object),
    )
    : new Map(await Promise.all(contentEntries.map(async ({ candidate, entry }) => [
      entry.object,
      await filesystem.snapshotFile(phaseGuidancePath(candidate)),
    ])));
  for (const { candidate, entry } of contentEntries) {
    const bytes = blobs.get(entry.object);
    if (bytes === undefined) {
      throw new Error(`Missing Git blob content for ${entry.object}`);
    }
    const inspected = inspectContent(bytes, entry, candidate);
    if (inspected.diagnostics) diagnostics.push(...inspected.diagnostics);
    if (phase !== undefined && inspected.guidance) {
      selectedGuidance = inspected.guidance;
    }
  }

  if (diagnostics.length > 0) return { state: "invalid", diagnostics };
  if (phase !== undefined && !selectedPresent) {
    return { state: "absent", diagnostics: [] };
  }
  return {
    state: "valid",
    diagnostics: [],
    ...(selectedGuidance === undefined ? {} : { guidance: selectedGuidance }),
  };
}

export async function inspectPhaseGuidance({
  filesystem,
  gitRoot,
  phase,
  snapshotTree,
}) {
  phaseGuidancePath(phase);
  return traceAsync(
    "guidance.inspect",
    { phase, scope: "phase" },
    async () => {
      try {
        return await inspectGuidanceInternal({
          filesystem,
          gitRoot,
          phase,
          snapshotTree,
        });
      } catch (caught) {
        return {
          state: "invalid",
          diagnostics: [error(
            "guidance.inspection-failed",
            phaseGuidancePath(phase),
            `Cannot inspect phase guidance for ${phase}: ${caught.message}`,
            "Repair the repository snapshot and retry.",
          )],
        };
      }
    },
  );
}

export async function inspectAllGuidance({
  filesystem,
  gitRoot,
  snapshotTree,
}) {
  return traceAsync(
    "guidance.inspect",
    { scope: "all" },
    async () => {
      try {
        return await inspectGuidanceInternal({
          filesystem,
          gitRoot,
          snapshotTree,
        });
      } catch (caught) {
        return {
          state: "invalid",
          diagnostics: [error(
            "guidance.inspection-failed",
            GUIDANCE_ROOT,
            `Cannot inspect phase guidance: ${caught.message}`,
            "Repair the repository snapshot and retry.",
          )],
        };
      }
    },
  );
}
