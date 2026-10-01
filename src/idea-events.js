import { isDeepStrictEqual } from "node:util";

import { isValidUlid, validateIdeaStatus } from "./ideas.js";

const FIELDS = Object.freeze({
  "alias.updated": ["alias", "alias"],
  "language.updated": ["language", "language"],
  "ideal.approved": ["idealRevision", "approvedRevision"],
  "implementation.accepted": ["implementationRevision", "implementationAcceptedRevision"],
  "deployment.accepted": ["deploymentRevision", "deploymentAcceptedRevision"],
});
export const IDEA_EVENT_TYPES = Object.freeze([
  ...Object.keys(FIELDS), "idea.abandoned", "idea.resumed",
]);
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
  if (!IDEA_EVENT_TYPES.includes(event?.type)) {
    throw new IdeaEventFormatError(`unsupported event type: ${String(event?.type)}`);
  }
  const field = FIELDS[event.type];
  keys(event, field ? ["sequence", "type", "payload"] : ["sequence", "type"], "event");
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
  return event;
}

export function serializeIdeaEvent(event, options) {
  validateIdeaEvent(event, options);
  const value = { sequence: event.sequence, type: event.type };
  const field = FIELDS[event.type];
  if (field) value.payload = { [field[0]]: event.payload[field[0]] };
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

export function initialEventState(ideaId) {
  if (!isValidUlid(ideaId)) throw new IdeaEventFormatError("invalid idea identity");
  return { status: { id: ideaId }, sequence: 0 };
}

export function reduceIdeaEvent(before, event, options) {
  validateIdeaEvent(event, options);
  const reject = (code) => ({ ok: false, code, sequence: event.sequence });
  if (event.sequence !== before.sequence + 1) return reject("sequence-conflict");
  const status = { ...before.status };
  const field = FIELDS[event.type];
  if (field) {
    const [input, output] = field;
    const value = event.payload[input];
    if (value === null) delete status[output];
    else status[output] = value;
  } else if (event.type === "idea.abandoned") {
    status.abandoned = true;
  } else {
    delete status.abandoned;
  }
  if (isDeepStrictEqual(status, before.status)) return reject("no-state-change");
  return { ok: true, state: { status, sequence: event.sequence } };
}

export function replayIdeaEvents(ideaId, events, options) {
  let state = initialEventState(ideaId);
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
  for (const [type, [input, output]] of Object.entries(FIELDS)) {
    if (Object.hasOwn(status, output)) {
      events.push({ sequence: events.length + 1, type, payload: { [input]: status[output] } });
    }
  }
  if (status.abandoned) events.push({ sequence: events.length + 1, type: "idea.abandoned" });
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
