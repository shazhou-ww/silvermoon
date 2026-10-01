import { isDeepStrictEqual } from "node:util";

import { isValidUlid, validateIdeaStatus } from "./ideas.js";

const LEGACY_FIELDS = Object.freeze({
  "alias.updated": ["alias", "alias"],
  "language.updated": ["language", "language"],
  "ideal.approved": ["idealRevision", "approvedRevision"],
  "implementation.accepted": ["implementationRevision", "implementationAcceptedRevision"],
  "deployment.accepted": ["deploymentRevision", "deploymentAcceptedRevision"],
});
export const EVENT_RENAMES = Object.freeze({
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
export const IDEA_EVENT_TYPES = Object.freeze([...Object.values(EVENT_RENAMES), "ping", "pong"]);
export function renameLegacyEvents(events) {
  return events.map((event) => {
    const type = EVENT_RENAMES[event.type];
    if (!type) throw new IdeaEventFormatError(`unsupported legacy event type: ${event.type}`);
    return { ...event, type };
  });
}
export const EVENT_PERMISSIONS = Object.freeze({
  setAlias: "both",
  setLanguage: "both",
  acceptIdeal: "upstream",
  acceptInner: "upstream",
  acceptOuter: "upstream",
  abandon: "upstream",
  resume: "upstream",
  ping: "upstream",
  pong: "downstream",
});
const LEGACY_TYPES = Object.fromEntries(
  Object.entries(EVENT_RENAMES).map(([legacy, current]) => [current, legacy]),
);
const VALIDATION_ID = "00000000000000000000000000";

export class IdeaEventFormatError extends Error {
  constructor(message, options) {
    super(`Invalid idea events: ${message}`, options);
    this.name = "IdeaEventFormatError";
  }
}

function keys(value, expected, label) {
  if (
    value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== expected.length
    || expected.some((key) => !Object.hasOwn(value, key))
  ) throw new IdeaEventFormatError(`${label} requires exactly ${expected.join(", ")}`);
}

export function validateIdeaEvent(event, options) {
  const legacy = options?.legacy === true;
  if (!(legacy ? LEGACY_EVENT_TYPES : IDEA_EVENT_TYPES).includes(event?.type)) {
    throw new IdeaEventFormatError(`unsupported event type: ${String(event?.type)}`);
  }
  const field = LEGACY_FIELDS[legacy ? event.type : LEGACY_TYPES[event.type]];
  const message = !legacy && (event.type === "ping" || event.type === "pong");
  keys(event, field || message ? ["sequence", "type", "payload"] : ["sequence", "type"], "event");
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new IdeaEventFormatError("sequence must be a positive safe integer");
  }
  if (field) {
    const [input, output] = field;
    keys(event.payload, [input], "payload");
    const value = event.payload[input];
    if (value === null && (output === "alias" || output === "language")) return event;
    try {
      validateIdeaStatus({ version: 1, id: VALIDATION_ID, [output]: value }, options);
    } catch (cause) {
      throw new IdeaEventFormatError(cause.message, { cause });
    }
  }
  if (message) {
    keys(event.payload, ["message"], "payload");
    if (typeof event.payload.message !== "string" || !event.payload.message.trim()) {
      throw new IdeaEventFormatError("message must be a nonempty string");
    }
  }
  return event;
}

export function serializeIdeaEvent(event, options) {
  validateIdeaEvent(event, options);
  const value = { sequence: event.sequence, type: event.type };
  const field = LEGACY_FIELDS[options?.legacy ? event.type : LEGACY_TYPES[event.type]];
  if (field) value.payload = { [field[0]]: event.payload[field[0]] };
  else if (event.type === "ping" || event.type === "pong") value.payload = { message: event.payload.message };
  return JSON.stringify(value);
}

export function serializeIdeaEvents(events, options) {
  if (!Array.isArray(events)) throw new IdeaEventFormatError("events must be an array");
  return events.map((event) => `${serializeIdeaEvent(event, options)}\n`).join("");
}

export function parseIdeaEvents(source, options) {
  let text;
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
      throw new IdeaEventFormatError(`line ${index + 1}: ${cause.message}`, { cause });
    }
  });
}

export function initialEventState(ideaId, options) {
  if (!isValidUlid(ideaId)) throw new IdeaEventFormatError("invalid idea identity");
  return options?.legacy
    ? { status: { id: ideaId }, sequence: 0 }
    : { status: { id: ideaId }, sequence: 0, interaction: { messages: [], lastSignal: null } };
}

export function reduceIdeaEvent(before, event, options) {
  validateIdeaEvent(event, options);
  const reject = (code) => ({ ok: false, code, sequence: event.sequence });
  if (event.sequence !== before.sequence + 1) return reject("sequence-conflict");
  const legacy = options?.legacy === true;
  if (!legacy && before.status.abandoned && event.type !== "resume") return reject("abandoned");
  const status = { ...before.status };
  const field = LEGACY_FIELDS[legacy ? event.type : LEGACY_TYPES[event.type]];
  if (field) {
    const [input, output] = field;
    const value = event.payload[input];
    if (value === null) delete status[output];
    else status[output] = value;
  } else if (event.type === "idea.abandoned" || event.type === "abandon") {
    status.abandoned = true;
  } else if (event.type === "idea.resumed" || event.type === "resume") {
    delete status.abandoned;
  }
  if (!legacy && (event.type === "ping" || event.type === "pong")) {
    return { ok: true, state: {
      status, sequence: event.sequence,
      interaction: {
        messages: [...before.interaction.messages, {
          sequence: event.sequence, type: event.type, message: event.payload.message,
        }],
        lastSignal: event.type,
      },
    } };
  }
  if (isDeepStrictEqual(status, before.status)) return reject("no-state-change");
  return { ok: true, state: legacy
    ? { status, sequence: event.sequence }
    : { status, sequence: event.sequence, interaction: before.interaction } };
}

export function replayIdeaEvents(ideaId, events, options) {
  let state = initialEventState(ideaId, options);
  for (const event of events) {
    const result = reduceIdeaEvent(state, event, options);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}

// The migration order is a representation order, not a reconstructed chronology.
export function eventsFromStatus(status, options) {
  validateIdeaStatus(status, options);
  const events = [];
  for (const [type, [input, output]] of Object.entries(LEGACY_FIELDS)) {
    if (Object.hasOwn(status, output)) {
      events.push({ sequence: events.length + 1,
        type: options?.legacy ? type : EVENT_RENAMES[type], payload: { [input]: status[output] } });
    }
  }
  if (status.abandoned) events.push({ sequence: events.length + 1,
    type: options?.legacy ? "idea.abandoned" : "abandon" });
  return events;
}

export function checkEventChange(ideaId, baseSource, candidateSource, options) {
  // Format errors deliberately do not become reduction failures or repair permission.
  function inspect(source, stage) {
    try { return replayIdeaEvents(ideaId, parseIdeaEvents(source, options), options); }
    catch (cause) {
      cause.eventStage = stage;
      throw cause;
    }
  }
  const base = inspect(baseSource, "base");
  const candidate = inspect(candidateSource, "candidate");
  const mode = base.ok ? "append" : "repair";
  if (!candidate.ok) return { ok: false, mode, base, candidate, code: candidate.code };
  if (base.ok && !Buffer.from(candidateSource).subarray(0, Buffer.byteLength(baseSource))
    .equals(Buffer.from(baseSource))) {
    return { ok: false, mode, base, candidate, code: "not-append-only" };
  }
  return { ok: true, mode, base, candidate };
}
