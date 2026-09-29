import { TextDecoder } from "node:util";

import {
  gitObjectSize,
  inspectTreeEntry,
  listTreeEntries,
  readGitBlob,
} from "./git.js";
import {
  GUIDANCE_PHASES,
  GUIDANCE_ROOT,
  phaseGuidancePath,
} from "./layout.js";
import { traceAsync } from "./trace.js";

export const MAX_PHASE_GUIDANCE_BYTES = 32 * 1024;

const REGULAR_FILE_MODES = new Set(["100644", "100755"]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

function invalidDirectory() {
  return error(
    "guidance.directory.invalid",
    GUIDANCE_ROOT,
    `Phase guidance path must be a repository-owned regular directory: ${GUIDANCE_ROOT}`,
    `Replace ${GUIDANCE_ROOT} with a regular directory without symlinks.`,
  );
}

function invalidFile(path) {
  return error(
    "guidance.file.invalid",
    path,
    `Phase guidance must be a repository-owned regular file: ${path}`,
    `Replace ${path} with a regular Markdown file without symlinks.`,
  );
}

function unexpectedEntry(name) {
  const path = `${GUIDANCE_ROOT}/${name}`;
  return error(
    "guidance.entry.unexpected",
    path,
    `Unexpected phase guidance entry: ${path}`,
    `Keep only preparing.md, implementing.md, and deploying.md in ${GUIDANCE_ROOT}.`,
  );
}

function inspectContent(gitRoot, entry, phase) {
  const path = phaseGuidancePath(phase);
  const size = gitObjectSize(gitRoot, entry.object);
  if (size > MAX_PHASE_GUIDANCE_BYTES) {
    return {
      diagnostic: error(
        "guidance.file.too-large",
        path,
        `Phase guidance exceeds the ${MAX_PHASE_GUIDANCE_BYTES}-byte limit: ${path}`,
        `Reduce ${path} to at most ${MAX_PHASE_GUIDANCE_BYTES} UTF-8 bytes.`,
      ),
    };
  }

  const bytes = readGitBlob(gitRoot, entry.object);
  if (bytes.length !== size) {
    throw new Error(
      `Git blob ${entry.object} changed size while reading ${path}`,
    );
  }

  const diagnostics = [];
  if (bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    diagnostics.push(error(
      "guidance.file.bom",
      path,
      `Phase guidance must not contain a UTF-8 byte order mark: ${path}`,
      `Remove the UTF-8 byte order mark from ${path}.`,
    ));
  }
  if (bytes.includes(0)) {
    diagnostics.push(error(
      "guidance.file.nul",
      path,
      `Phase guidance must not contain NUL bytes: ${path}`,
      `Remove all NUL bytes from ${path}.`,
    ));
  }

  let content;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    diagnostics.push(error(
      "guidance.file.invalid-utf8",
      path,
      `Phase guidance must contain valid UTF-8: ${path}`,
      `Encode ${path} as valid UTF-8 without a byte order mark.`,
    ));
  }
  if (content !== undefined && content.trim().length === 0) {
    diagnostics.push(error(
      "guidance.file.empty",
      path,
      `Phase guidance must contain non-whitespace content: ${path}`,
      `Add project guidance to ${path}, or remove the optional file.`,
    ));
  }
  if (diagnostics.length > 0) return { diagnostics };

  return {
    guidance: {
      phase,
      path,
      contentRevision: entry.object,
      content: content.replaceAll("\r\n", "\n"),
    },
  };
}

async function inspectGuidanceInternal({
  gitRoot,
  phase,
  snapshotTree,
}) {
  const rootEntry = inspectTreeEntry(gitRoot, snapshotTree, GUIDANCE_ROOT);
  if (rootEntry === null) {
    return { state: "absent", diagnostics: [] };
  }
  if (rootEntry.type !== "tree" || rootEntry.mode !== "040000") {
    return { state: "invalid", diagnostics: [invalidDirectory()] };
  }

  const entries = listTreeEntries(gitRoot, rootEntry.object, GUIDANCE_ROOT);
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
    const inspected = inspectContent(gitRoot, entry, candidate);
    if (inspected.diagnostic) diagnostics.push(inspected.diagnostic);
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
  gitRoot,
  snapshotTree,
}) {
  return traceAsync(
    "guidance.inspect",
    { scope: "all" },
    async () => {
      try {
        return await inspectGuidanceInternal({ gitRoot, snapshotTree });
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
