import { contentSizeDiagnostic, error, inspectContent, invalidDirectory, invalidFile, unexpectedEntry } from "./rules.ts";
export { MAX_PHASE_GUIDANCE_BYTES } from "./rules.ts";

import { inspectTree, readGitBlobs } from "../git/index.ts";
import { GUIDANCE_PHASES, GUIDANCE_ROOT, phaseGuidancePath } from "../coordinates/index.ts";
import { traceAsync } from "../trace/index.ts";
import type {
  GuidanceBlobEntry,
  GuidanceDiagnostic,
} from "./rules.ts";

const REGULAR_FILE_MODES = new Set(["100644", "100755"]);

interface GuidanceTreeEntry extends Omit<GuidanceBlobEntry, "size"> {
  mode: string;
  name: string;
  size: number | null;
  type: string;
}

interface GuidanceFilesystem {
  snapshotEntry(path: string): unknown;
  snapshotEntries(path: string): unknown;
  snapshotFile(path: string): Promise<Buffer>;
}

interface GuidanceInspectionOptions {
  filesystem?: GuidanceFilesystem | undefined;
  gitRoot: string;
  phase?: string | undefined;
  snapshotTree: string | unknown[];
}

interface PhaseGuidanceInspectionOptions extends GuidanceInspectionOptions {
  phase: string;
}

interface PhaseGuidance {
  phase: string;
  path: string;
  contentRevision: string;
  content: string;
}

type GuidanceInspection =
  | { state: "absent"; diagnostics: GuidanceDiagnostic[] }
  | { state: "invalid"; diagnostics: GuidanceDiagnostic[] }
  | {
      state: "valid";
      diagnostics: GuidanceDiagnostic[];
      guidance?: PhaseGuidance;
    };

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

function guidanceTreeEntry(value: unknown): GuidanceTreeEntry {
  if (
    !isMapping(value)
    || typeof value.mode !== "string"
    || typeof value.name !== "string"
    || typeof value.object !== "string"
    || typeof value.type !== "string"
    || (value.size !== null && (
      typeof value.size !== "number"
      || !Number.isSafeInteger(value.size)
      || value.size < 0
    ))
  ) {
    throw new Error("Invalid phase guidance tree entry");
  }
  return {
    mode: value.mode,
    name: value.name,
    object: value.object,
    size: value.size,
    type: value.type,
  };
}

function guidanceTreeEntries(value: unknown): GuidanceTreeEntry[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid phase guidance tree entries");
  }
  return value.map(guidanceTreeEntry);
}

function caughtMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

async function traceGuidance(
  attributes: { phase?: string; scope: string },
  callback: () => Promise<GuidanceInspection>,
): Promise<GuidanceInspection> {
  let completed: GuidanceInspection | undefined;
  const traced: unknown = Reflect.apply(traceAsync, undefined, [
    "guidance.inspect",
    attributes,
    async () => {
      completed = await callback();
      return completed;
    },
  ]);
  if (!(traced instanceof Promise)) {
    throw new Error("Guidance trace did not return a promise");
  }
  await traced;
  if (completed === undefined) {
    throw new Error("Guidance trace completed without a result");
  }
  return completed;
}

async function inspectGuidanceInternal({
  filesystem,
  gitRoot,
  phase,
  snapshotTree,
}: GuidanceInspectionOptions): Promise<GuidanceInspection> {
  let treeEntries: GuidanceTreeEntry[] | null;
  if (filesystem === undefined) {
    if (typeof snapshotTree !== "string") {
      throw new TypeError("Git guidance inspection requires a snapshot tree object ID.");
    }
    treeEntries = guidanceTreeEntries(
      inspectTree(gitRoot, snapshotTree, GUIDANCE_ROOT),
    );
  } else {
    treeEntries = null;
  }
  const rootEntryValue = treeEntries === null
    ? filesystem?.snapshotEntry(GUIDANCE_ROOT)
    : treeEntries.find(({ name }) => name === GUIDANCE_ROOT);
  const rootEntry = rootEntryValue === null || rootEntryValue === undefined
    ? null
    : guidanceTreeEntry(rootEntryValue);
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
      ? guidanceTreeEntries(filesystem?.snapshotEntries(GUIDANCE_ROOT))
      : treeEntries.filter(({ name }) =>
        name.startsWith(prefix) && !name.slice(prefix.length).includes("/")
      )
  )
    .map((entry) => ({ ...entry, name: entry.name.slice(prefix.length) }));
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const phases = phase === undefined ? GUIDANCE_PHASES : [phase];
  const diagnostics: GuidanceDiagnostic[] = [];

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

  let selectedGuidance: PhaseGuidance | undefined;
  let selectedPresent = false;
  const contentEntries: {
    candidate: string;
    entry: GuidanceTreeEntry & { size: number };
  }[] = [];
  for (const candidate of phases) {
    const path = phaseGuidancePath(candidate);
    const name = path.slice(`${GUIDANCE_ROOT}/`.length);
    const entry = entriesByName.get(name);
    if (entry === undefined) continue;
    selectedPresent = true;
    if (
      entry.type !== "blob"
      || entry.size === null
      || !REGULAR_FILE_MODES.has(entry.mode)
    ) {
      diagnostics.push(invalidFile(path));
      continue;
    }
    const contentEntry = { ...entry, size: entry.size };
    const sizeDiagnostic = contentSizeDiagnostic(contentEntry, candidate);
    if (sizeDiagnostic) {
      diagnostics.push(sizeDiagnostic);
      continue;
    }
    contentEntries.push({ candidate, entry: contentEntry });
  }

  const blobs = new Map<string, Buffer>();
  if (filesystem === undefined) {
    const loaded = readGitBlobs(
      gitRoot,
      contentEntries.map(({ entry }) => entry.object),
    );
    for (const { entry } of contentEntries) {
      const bytes = loaded.get(entry.object);
      if (!Buffer.isBuffer(bytes)) {
        throw new Error(`Missing Git blob content for ${entry.object}`);
      }
      blobs.set(entry.object, bytes);
    }
  } else {
    await Promise.all(contentEntries.map(async ({ candidate, entry }) => {
      blobs.set(
        entry.object,
        await filesystem.snapshotFile(phaseGuidancePath(candidate)),
      );
    }));
  }
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
}: PhaseGuidanceInspectionOptions): Promise<GuidanceInspection> {
  phaseGuidancePath(phase);
  return traceGuidance(
    { phase, scope: "phase" },
    async (): Promise<GuidanceInspection> => {
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
            `Cannot inspect phase guidance for ${phase}: ${caughtMessage(caught)}`,
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
}: Omit<GuidanceInspectionOptions, "phase">): Promise<GuidanceInspection> {
  return traceGuidance(
    { scope: "all" },
    async (): Promise<GuidanceInspection> => {
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
            `Cannot inspect phase guidance: ${caughtMessage(caught)}`,
            "Repair the repository snapshot and retry.",
          )],
        };
      }
    },
  );
}
