import { GUIDANCE_ROOT, phaseGuidancePath } from "./layout.js";

export const MAX_PHASE_GUIDANCE_BYTES = 32 * 1024;
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** @pure */
export function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

/** @pure */
export function invalidDirectory() {
  return error(
    "guidance.directory.invalid",
    GUIDANCE_ROOT,
    `Phase guidance path must be a repository-owned regular directory: ${GUIDANCE_ROOT}`,
    `Replace ${GUIDANCE_ROOT} with a regular directory without symlinks.`,
  );
}

/** @pure */
export function invalidFile(path) {
  return error(
    "guidance.file.invalid",
    path,
    `Phase guidance must be a repository-owned regular file: ${path}`,
    `Replace ${path} with a regular Markdown file without symlinks.`,
  );
}

/** @pure */
export function unexpectedEntry(name) {
  const path = `${GUIDANCE_ROOT}/${name}`;
  return error(
    "guidance.entry.unexpected",
    path,
    `Unexpected phase guidance entry: ${path}`,
    `Keep only preparing.md, implementing.md, and deploying.md in ${GUIDANCE_ROOT}.`,
  );
}

/** @pure */
export function contentSizeDiagnostic(entry, phase) {
  const path = phaseGuidancePath(phase);
  if (entry.size <= MAX_PHASE_GUIDANCE_BYTES) return null;
  return error(
    "guidance.file.too-large",
    path,
    `Phase guidance exceeds the ${MAX_PHASE_GUIDANCE_BYTES}-byte limit: ${path}`,
    `Reduce ${path} to at most ${MAX_PHASE_GUIDANCE_BYTES} UTF-8 bytes.`,
  );
}

/** @pure */
export function inspectContent(bytes, entry, phase) {
  const path = phaseGuidancePath(phase);
  if (bytes.length !== entry.size) {
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
