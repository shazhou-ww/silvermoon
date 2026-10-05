/** @pure */
export function assertSchemaVersion(value, supported, description = "schema") {
  if (!Number.isSafeInteger(value) || !supported.includes(value)) {
    throw new Error(`Unsupported ${description} version: ${value}`);
  }
  return value;
}
