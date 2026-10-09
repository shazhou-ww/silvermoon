import { isDeepStrictEqual } from "node:util";

import { isValidUlid, validateIdeaStatus } from "../idea-model/index.ts";

export type EventCodecOptions = {
  objectIdLength?: number;
  legacy?: boolean;
};

type EventSource = string|NodeJS.ArrayBufferView|ArrayBuffer;
type EventPayload = Record<string, string|null>;
type SignalEvent = {
  sequence: number;
  type: "ping"|"pong";
  payload: EventPayload & { message: string };
};
type FieldEvent = {
  sequence: number;
  type: "setAlias"|"setLanguage"
    |"submitIdeal"|"submitInner"|"submitOuter"
    |"acceptIdeal"|"acceptInner"|"acceptOuter"
    |"alias.updated"|"language.updated"|"ideal.approved"
    |"implementation.accepted"|"deployment.accepted";
  payload: EventPayload;
};
type StateEvent = {
  sequence: number;
  type: "abandon"|"resume"|"idea.abandoned"|"idea.resumed";
};
export type IdeaEvent = SignalEvent|FieldEvent|StateEvent;

export type IdeaEventStatus = Record<string, string|true|undefined> & {
  id: string;
  alias?: string;
  language?: string;
  abandoned?: true;
  approvedRevision?: string;
  implementationAcceptedRevision?: string;
  deploymentAcceptedRevision?: string;
  submittedIdealRevision?: string;
  submittedImplementationRevision?: string;
  submittedDeploymentRevision?: string;
};

export type IdeaControlOwner = "upstream"|"downstream"|"none";

export interface IdeaControl {
  owner: IdeaControlOwner;
  lastTransfer: {
    sequence: number;
    type:
      | "ping" | "pong"
      | "submitIdeal" | "submitInner" | "submitOuter"
      | "acceptIdeal" | "acceptInner" | "acceptOuter"
      | "abandon" | "resume";
  } | null;
}

export type IdeaEventState = {
  status: IdeaEventStatus;
  sequence: number;
  interaction?: {
    messages: Array<{ sequence: number; type: "ping"|"pong"; message: string }>;
  };
  control?: IdeaControl;
};

export type IdeaEventReduction =
  | { ok: false; code: string; sequence: number }
  | { ok: true; state: IdeaEventState };

/** @pure */
export function eventLifecycleStatus(status: IdeaEventStatus): {
  version: 1;
  id: string;
  alias?: string;
  language?: string;
  abandoned?: true;
  approvedRevision?: string;
  implementationAcceptedRevision?: string;
  deploymentAcceptedRevision?: string;
} {
  return validateIdeaStatus({
    version: 1,
    id: status.id,
    ...(status.alias === undefined ? {} : { alias: status.alias }),
    ...(status.language === undefined ? {} : { language: status.language }),
    ...(status.abandoned === undefined ? {} : { abandoned: status.abandoned }),
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
      : {
          deploymentAcceptedRevision: status.deploymentAcceptedRevision,
        }),
  });
}

const LEGACY_FIELDS: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  "alias.updated": ["alias", "alias"],
  "language.updated": ["language", "language"],
  "ideal.approved": ["idealRevision", "approvedRevision"],
  "implementation.accepted": ["implementationRevision", "implementationAcceptedRevision"],
  "deployment.accepted": ["deploymentRevision", "deploymentAcceptedRevision"],
});
const SUBMISSION_FIELDS: Readonly<
  Record<string, readonly [string, string, string]>
> = Object.freeze({
  submitIdeal: ["idealRevision", "submittedIdealRevision", "approvedRevision"],
  submitInner: [
    "implementationRevision",
    "submittedImplementationRevision",
    "implementationAcceptedRevision",
  ],
  submitOuter: [
    "deploymentRevision",
    "submittedDeploymentRevision",
    "deploymentAcceptedRevision",
  ],
});
export const EVENT_RENAMES: Readonly<Record<string, string>> = Object.freeze({
  "alias.updated": "setAlias",
  "language.updated": "setLanguage",
  "ideal.approved": "acceptIdeal",
  "implementation.accepted": "acceptInner",
  "deployment.accepted": "acceptOuter",
  "idea.abandoned": "abandon",
  "idea.resumed": "resume",
});
export const LEGACY_EVENT_TYPES = Object.freeze([
  ...Object.keys(LEGACY_FIELDS), "idea.abandoned", "idea.resumed",
]);
export const IDEA_EVENT_TYPES = Object.freeze([
  ...Object.values(EVENT_RENAMES),
  ...Object.keys(SUBMISSION_FIELDS),
  "ping",
  "pong",
]);
/** @pure */
export function renameLegacyEvents(events: unknown[]) {
  return events.map((event) => {
    const validated = validateIdeaEvent(event, { legacy: true });
    const type = EVENT_RENAMES[validated.type];
    if (!type) throw new IdeaEventFormatError(`unsupported legacy event type: ${validated.type}`);
    return { ...validated, type };
  });
}
export const EVENT_PERMISSIONS = Object.freeze({
  setAlias: "both",
  setLanguage: "both",
  submitIdeal: "downstream",
  submitInner: "downstream",
  submitOuter: "downstream",
  acceptIdeal: "upstream",
  acceptInner: "upstream",
  acceptOuter: "upstream",
  abandon: "upstream",
  resume: "upstream",
  ping: "upstream",
  pong: "downstream",
});
const LEGACY_TYPES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(EVENT_RENAMES).map(([legacy, current]) => [current, legacy]),
);
const CONTROL_OWNERS: Readonly<Record<string, IdeaControlOwner>> = Object.freeze({
  ping: "downstream",
  pong: "upstream",
  submitIdeal: "upstream",
  submitInner: "upstream",
  submitOuter: "upstream",
  acceptIdeal: "downstream",
  acceptInner: "downstream",
  acceptOuter: "none",
  abandon: "none",
  resume: "downstream",
});
const VALIDATION_ID = "00000000000000000000000000";

type FieldDefinition = readonly [string, string, string?];

/** @pure */
function fieldDefinition(type: string, legacy: boolean): FieldDefinition | undefined {
  if (legacy) return LEGACY_FIELDS[type];
  const legacyType = LEGACY_TYPES[type];
  return (legacyType === undefined ? undefined : LEGACY_FIELDS[legacyType])
    ?? SUBMISSION_FIELDS[type];
}

export class IdeaEventFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`Invalid idea events: ${message}`, options);
    this.name = "IdeaEventFormatError";
  }
}

/** @pure */
function keys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (
    value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== expected.length
    || expected.some((key) => !Object.hasOwn(value, key))
  ) throw new IdeaEventFormatError(`${label} requires exactly ${expected.join(", ")}`);
}

/** @pure */
function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

/** @pure */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @pure */
function payloadValue(event: IdeaEvent, key: string): string|null {
  if (!("payload" in event)) {
    throw new IdeaEventFormatError(`payload requires exactly ${key}`);
  }
  const value = event.payload[key];
  if (typeof value !== "string" && value !== null) {
    throw new IdeaEventFormatError(`payload requires exactly ${key}`);
  }
  return value;
}

/** @pure */
function assertValidIdeaEvent(
  event: unknown,
  options: EventCodecOptions|undefined,
): asserts event is IdeaEvent {
  const legacy = options?.legacy === true;
  const type = isRecord(event) ? event.type : undefined;
  if (typeof type !== "string"
    || !(legacy ? LEGACY_EVENT_TYPES : IDEA_EVENT_TYPES).includes(type)) {
    throw new IdeaEventFormatError(`unsupported event type: ${String(type)}`);
  }
  const field = fieldDefinition(type, legacy);
  const message = !legacy && (type === "ping" || type === "pong");
  keys(event, field || message ? ["sequence", "type", "payload"] : ["sequence", "type"], "event");
  if (!Number.isSafeInteger(event.sequence)
    || typeof event.sequence !== "number" || event.sequence < 1) {
    throw new IdeaEventFormatError("sequence must be a positive safe integer");
  }
  if (field) {
    const [input, output, validationOutput = output] = field;
    keys(event.payload, [input], "payload");
    const value = event.payload[input];
    if (value === null && (output === "alias" || output === "language")) return;
    try {
      validateIdeaStatus({
        version: 1,
        id: VALIDATION_ID,
        [validationOutput]: value,
      }, options);
    } catch (cause) {
      throw new IdeaEventFormatError(errorMessage(cause), { cause });
    }
  }
  if (message) {
    keys(event.payload, ["message"], "payload");
    if (typeof event.payload.message !== "string" || !event.payload.message.trim()) {
      throw new IdeaEventFormatError("message must be a nonempty string");
    }
  }
}

/** @pure */
export function validateIdeaEvent(event: unknown, options?: EventCodecOptions): IdeaEvent {
  assertValidIdeaEvent(event, options);
  return event;
}

/** @pure */
export function serializeIdeaEvent(event: unknown, options?: EventCodecOptions) {
  const validated = validateIdeaEvent(event, options);
  const value: { sequence: number; type: string; payload?: EventPayload } = {
    sequence: validated.sequence,
    type: validated.type,
  };
  const field = fieldDefinition(validated.type, options?.legacy === true);
  if (field && "payload" in validated) {
    value.payload = { [field[0]]: payloadValue(validated, field[0]) };
  } else if (validated.type === "ping" || validated.type === "pong") {
    value.payload = { message: validated.payload.message };
  }
  return JSON.stringify(value);
}

/** @pure */
export function serializeIdeaEvents(events: unknown, options?: EventCodecOptions) {
  if (!Array.isArray(events)) throw new IdeaEventFormatError("events must be an array");
  return events.map((event) => `${serializeIdeaEvent(event, options)}\n`).join("");
}

/** @pure */
export function parseIdeaEvents(
  source: EventSource|undefined,
  options?: EventCodecOptions,
): IdeaEvent[] {
  let text: string;
  try {
    text = typeof source === "string"
      ? source
      : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
  } catch (cause) {
    throw new IdeaEventFormatError("log must contain valid UTF-8", { cause });
  }
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new IdeaEventFormatError("last record must end with LF");
  return text.slice(0, -1).split("\n").map((line, index) => {
    try {
      const event = JSON.parse(line);
      if (serializeIdeaEvent(event, options) !== line) {
        throw new IdeaEventFormatError("record is not canonical JSON");
      }
      return event;
    } catch (cause) {
      throw new IdeaEventFormatError(`line ${index + 1}: ${errorMessage(cause)}`, { cause });
    }
  });
}

/** @pure */
export function initialEventState(
  ideaId: string|undefined,
  options?: EventCodecOptions,
): IdeaEventState {
  if (!isValidUlid(ideaId)) throw new IdeaEventFormatError("invalid idea identity");
  return options?.legacy
    ? { status: { id: ideaId }, sequence: 0 }
    : {
        status: { id: ideaId },
        sequence: 0,
        interaction: { messages: [] },
        control: { owner: "downstream", lastTransfer: null },
      };
}

/** @pure */
function nextControl(
  before: IdeaEventState,
  event: IdeaEvent,
): IdeaControl {
  if (!before.control) {
    throw new IdeaEventFormatError("current events require control state");
  }
  const owner = CONTROL_OWNERS[event.type];
  if (owner === undefined) return before.control;
  return {
    owner,
    lastTransfer: {
      sequence: event.sequence,
      type: event.type as NonNullable<IdeaControl["lastTransfer"]>["type"],
    },
  };
}

/** @pure */
export function reduceIdeaEvent(
  before: IdeaEventState,
  event: unknown,
  options?: EventCodecOptions,
): IdeaEventReduction {
  const validated = validateIdeaEvent(event, options);
  const reject = (code: string): IdeaEventReduction =>
    ({ ok: false, code, sequence: validated.sequence });
  if (validated.sequence !== before.sequence + 1) return reject("sequence-conflict");
  const legacy = options?.legacy === true;
  if (!legacy && before.status.abandoned && validated.type !== "resume") return reject("abandoned");
  const status = { ...before.status };
  const field = fieldDefinition(validated.type, legacy);
  if (field && "payload" in validated) {
    const [input, output] = field;
    const value = payloadValue(validated, input);
    if (value === null) delete status[output];
    else status[output] = value;
  } else if (validated.type === "idea.abandoned" || validated.type === "abandon") {
    status.abandoned = true;
  } else if (validated.type === "idea.resumed" || validated.type === "resume") {
    delete status.abandoned;
  }
  if (!legacy && (validated.type === "ping" || validated.type === "pong")) {
    if (!before.interaction) {
      throw new IdeaEventFormatError("current events require interaction state");
    }
    return { ok: true, state: {
      status, sequence: validated.sequence,
      interaction: {
        messages: [...before.interaction.messages, {
          sequence: validated.sequence,
          type: validated.type,
          message: validated.payload.message,
        }],
      },
      control: nextControl(before, validated),
    } };
  }
  if (isDeepStrictEqual(status, before.status)) return reject("no-state-change");
  if (legacy) return { ok: true, state: { status, sequence: validated.sequence } };
  if (!before.interaction) {
    throw new IdeaEventFormatError("current events require interaction state");
  }
  return { ok: true, state: {
    status,
    sequence: validated.sequence,
    interaction: before.interaction,
    control: nextControl(before, validated),
  } };
}

/** @pure */
export function replayIdeaEvents(
  ideaId: string,
  events: readonly unknown[],
  options?: EventCodecOptions,
): IdeaEventReduction {
  let state = initialEventState(ideaId, options);
  for (const event of events) {
    const result = reduceIdeaEvent(state, event, options);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}

// The migration order is a representation order, not a reconstructed chronology.
/** @pure */
export function eventsFromStatus(
  status: IdeaEventStatus & { version: 1 },
  options?: EventCodecOptions,
) {
  validateIdeaStatus(status, options);
  const events = [];
  for (const [type, [input, output]] of Object.entries(LEGACY_FIELDS)) {
    if (Object.hasOwn(status, output)) {
      events.push({ sequence: events.length + 1,
        type: options?.legacy ? type : EVENT_RENAMES[type],
        payload: { [input]: status[output] } });
    }
  }
  if (status.abandoned) events.push({ sequence: events.length + 1,
    type: options?.legacy ? "idea.abandoned" : "abandon" });
  return events;
}

/** @pure */
export function checkEventChange(
  ideaId: string,
  baseSource: EventSource,
  candidateSource: EventSource,
  options?: EventCodecOptions,
) {
  // Format errors deliberately do not become reduction failures or repair permission.
  function inspect(source: EventSource, stage: string) {
    try { return replayIdeaEvents(ideaId, parseIdeaEvents(source, options), options); }
    catch (cause) {
      if (cause instanceof Error) {
        Object.defineProperty(cause, "eventStage", { value: stage, configurable: true });
      }
      throw cause;
    }
  }
  const base = inspect(baseSource, "base");
  const candidate = inspect(candidateSource, "candidate");
  const mode = base.ok ? "append" : "repair";
  if (!candidate.ok) return { ok: false, mode, base, candidate, code: candidate.code };
  const baseBytes = sourceBuffer(baseSource);
  if (base.ok && !sourceBuffer(candidateSource).subarray(0, baseBytes.length)
    .equals(baseBytes)) {
    return { ok: false, mode, base, candidate, code: "not-append-only" };
  }
  return { ok: true, mode, base, candidate };
}

/** @pure */
function sourceBuffer(source: EventSource): Buffer {
  if (typeof source === "string") return Buffer.from(source);
  if (ArrayBuffer.isView(source)) {
    return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  }
  return Buffer.from(source);
}
