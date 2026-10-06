import { parseStrictYaml, stringifyCanonicalYaml } from "../schema/index.ts";
import { isCanonicalLanguageTag } from "../language/index.ts";

export const IDEA_STATES: IdeaState[] = [
  "preparing",
  "implementing",
  "deploying",
  "completed",
  "abandoned",
];
export const ACTIVE_IDEA_STATES: IdeaState[] = IDEA_STATES.slice(0, 3);

export type IdeaState = "preparing" | "implementing" | "deploying" | "completed" | "abandoned";

interface IdeaStatus {
  version: 1;
  id: string;
  alias?: string;
  language?: string;
  abandoned?: true;
  approvedRevision?: string;
  implementationAcceptedRevision?: string;
  deploymentAcceptedRevision?: string;
}

interface IdeaStatusOptions {
  objectIdLength?: number;
}

interface IdeaRevisions {
  idealRevision: string;
  implementationRevision: string;
  deploymentRevision: string;
}

type RevisionKey =
  | "approvedRevision"
  | "implementationAcceptedRevision"
  | "deploymentAcceptedRevision";

const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const STATUS_KEYS = new Set([
  "version",
  "id",
  "alias",
  "language",
  "abandoned",
  "approvedRevision",
  "implementationAcceptedRevision",
  "deploymentAcceptedRevision",
]);
const REVISION_KEYS: RevisionKey[] = [
  "approvedRevision",
  "implementationAcceptedRevision",
  "deploymentAcceptedRevision",
];

/** @pure */
function ideaStatusError(message: string) {
  return new Error(`Invalid idea status: ${message}`);
}

/** @pure */
function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

/** @pure */
function isValidAlias(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    [...value].length <= 120 &&
    !CONTROL_CHARACTER.test(value)
  );
}

/** @pure */
export function isValidUlid(value: unknown): value is string {
  return typeof value === "string" && ULID.test(value);
}

/** @pure */
export function validateIdeaStatus(
  value: unknown,
  { objectIdLength }: IdeaStatusOptions = {},
): IdeaStatus {
  if (!isMapping(value)) throw ideaStatusError("document must be a mapping");
  for (const key of Object.keys(value)) {
    if (!STATUS_KEYS.has(key)) throw ideaStatusError(`unknown field: ${key}`);
  }
  for (const key of ["version", "id"]) {
    if (!Object.hasOwn(value, key)) throw ideaStatusError(`missing ${key}`);
  }
  if (value.version !== 1) throw ideaStatusError("version must be 1");
  if (!isValidUlid(value.id)) throw ideaStatusError("id must be a canonical ULID");
  if (Object.hasOwn(value, "alias") && !isValidAlias(value.alias)) {
    throw ideaStatusError("alias must be 1 to 120 trimmed characters without controls");
  }
  if (
    Object.hasOwn(value, "language") &&
    (typeof value.language !== "string"
      || !isCanonicalLanguageTag(value.language))
  ) {
    throw ideaStatusError("language must be a canonical BCP 47 language tag");
  }
  if (Object.hasOwn(value, "abandoned") && value.abandoned !== true) {
    throw ideaStatusError("abandoned must be omitted or true");
  }
  if (
    objectIdLength !== undefined &&
    (!Number.isInteger(objectIdLength) || objectIdLength <= 0)
  ) {
    throw ideaStatusError("objectIdLength must be a positive integer");
  }
  for (const key of REVISION_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    if (
      typeof value[key] !== "string" ||
      !OBJECT_ID.test(value[key]) ||
      (objectIdLength !== undefined && value[key].length !== objectIdLength)
    ) {
      throw ideaStatusError(`${key} must be a lowercase hexadecimal Git object ID`);
    }
  }
  return {
    version: 1,
    id: value.id,
    ...(typeof value.alias === "string" ? { alias: value.alias } : {}),
    ...(typeof value.language === "string" ? { language: value.language } : {}),
    ...(value.abandoned === true ? { abandoned: true } : {}),
    ...(typeof value.approvedRevision === "string"
      ? { approvedRevision: value.approvedRevision }
      : {}),
    ...(typeof value.implementationAcceptedRevision === "string"
      ? {
          implementationAcceptedRevision:
            value.implementationAcceptedRevision,
        }
      : {}),
    ...(typeof value.deploymentAcceptedRevision === "string"
      ? { deploymentAcceptedRevision: value.deploymentAcceptedRevision }
      : {}),
  };
}

/** @pure */
export function serializeIdeaStatus(value: unknown, options?: IdeaStatusOptions) {
  const status = validateIdeaStatus(value, options);
  const canonical = {
    version: 1,
    id: status.id,
    ...(status.alias === undefined ? {} : { alias: status.alias }),
    ...(status.language === undefined ? {} : { language: status.language }),
    ...(status.abandoned === true ? { abandoned: true } : {}),
    ...(status.approvedRevision === undefined
      ? {}
      : { approvedRevision: status.approvedRevision }),
    ...(status.implementationAcceptedRevision === undefined
      ? {}
      : {
          implementationAcceptedRevision:
            status.implementationAcceptedRevision,
        }),
    ...(status.deploymentAcceptedRevision === undefined
      ? {}
      : { deploymentAcceptedRevision: status.deploymentAcceptedRevision }),
  };
  return stringifyCanonicalYaml(canonical);
}

/** @pure */
export function parseIdeaStatus(source: string, options?: IdeaStatusOptions) {
  const normalizedSource = source.replaceAll("\r\n", "\n");
  let value: unknown;
  try {
    value = parseStrictYaml(normalizedSource);
  } catch (caught) {
    throw ideaStatusError(
      caught instanceof Error ? caught.message : String(caught),
    );
  }
  const status = validateIdeaStatus(value, options);
  if (serializeIdeaStatus(status, options) !== normalizedSource) {
    throw ideaStatusError("status is not canonical");
  }
  return status;
}

/** @pure */
function validateIdeaRevisions(value: unknown): IdeaRevisions {
  if (!isMapping(value)) {
    throw ideaStatusError("revisions must be a mapping");
  }
  const idealRevision = value.idealRevision;
  const implementationRevision = value.implementationRevision;
  const deploymentRevision = value.deploymentRevision;
  for (const [key, revision] of [
    ["idealRevision", idealRevision],
    ["implementationRevision", implementationRevision],
    ["deploymentRevision", deploymentRevision],
  ]) {
    if (typeof revision !== "string" || !OBJECT_ID.test(revision)) {
      throw ideaStatusError(`${key} must be a lowercase hexadecimal Git object ID`);
    }
  }
  if (
    typeof idealRevision !== "string"
    || typeof implementationRevision !== "string"
    || typeof deploymentRevision !== "string"
  ) {
    throw ideaStatusError("revisions must contain Git object IDs");
  }
  return {
    idealRevision,
    implementationRevision,
    deploymentRevision,
  };
}

/** @pure */
export function deriveIdeaState(revisions: unknown, status: unknown): IdeaState {
  const validatedRevisions = validateIdeaRevisions(revisions);
  const validatedStatus = validateIdeaStatus(status);
  if (validatedStatus.abandoned) return "abandoned";
  if (validatedStatus.approvedRevision !== validatedRevisions.idealRevision) {
    return "preparing";
  }
  if (
    validatedStatus.implementationAcceptedRevision
      !== validatedRevisions.implementationRevision
  ) return "implementing";
  if (
    validatedStatus.deploymentAcceptedRevision
      !== validatedRevisions.deploymentRevision
  ) return "deploying";
  return "completed";
}
