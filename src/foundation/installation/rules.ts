interface SemanticVersion {
  major: string;
  minor: string;
  patch: string;
  prerelease: string[];
}

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** @pure */
export function parseSemanticVersion(value: unknown): SemanticVersion | null {
  if (typeof value !== "string") return null;
  const match = SEMVER_PATTERN.exec(value);
  const major = match?.[1];
  const minor = match?.[2];
  const patch = match?.[3];
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    prerelease: match?.[4]?.split(".") ?? [],
  };
}

/** @pure */
export function resolveRuntimeUpdateChannel(value: unknown): string | null {
  const version = parseSemanticVersion(value);
  if (!version) return null;
  const channel = version.prerelease[0];
  if (channel === undefined) return "latest";
  return /^[A-Za-z][0-9A-Za-z-]*$/.test(channel)
    ? channel.toLowerCase()
    : null;
}

/** @pure */
function compareNumericIdentifiers(left: string, right: string) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @pure */
export function compareSemanticVersions(left: unknown, right: unknown) {
  const leftVersion = parseSemanticVersion(left);
  const rightVersion = parseSemanticVersion(right);
  if (!leftVersion || !rightVersion) return null;
  for (const field of ["major", "minor", "patch"] as const) {
    const comparison = compareNumericIdentifiers(
      leftVersion[field],
      rightVersion[field],
    );
    if (comparison !== 0) return comparison;
  }
  if (leftVersion.prerelease.length === 0) {
    return rightVersion.prerelease.length === 0 ? 0 : 1;
  }
  if (rightVersion.prerelease.length === 0) return -1;
  const length = Math.max(
    leftVersion.prerelease.length,
    rightVersion.prerelease.length,
  );
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return compareNumericIdentifiers(leftPart, rightPart);
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}
