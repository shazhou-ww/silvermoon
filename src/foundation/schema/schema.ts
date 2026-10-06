/** @pure */
export function assertSchemaVersion(
  value: unknown,
  supported: readonly number[],
  description = "schema",
): number {
  if (typeof value !== "number"
    || !Number.isSafeInteger(value)
    || !supported.includes(value)) {
    throw new Error(`Unsupported ${description} version: ${value}`);
  }
  return value;
}
