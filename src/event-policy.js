import { EVENTS_PER_SEGMENT, MAX_EVENT_BYTES, eventFolderDigest, gitContentDigest, segmentName } from "./event-digest.js";
import { IdeaEventFormatError, parseIdeaEvents, reduceIdeaEvent, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { deriveIdeaState } from "./ideas.js";

const DECISIONS = {
  acceptIdeal: ["idealRevision", "preparing"],
  acceptInner: ["implementationRevision", "implementing"],
  acceptOuter: ["deploymentRevision", "deploying"],
};

/** @pure */
export function parseRequest(input, sequence, options) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.hasOwn(input, "sequence")) {
    throw new Error("Supply a business request object without sequence; the CLI assigns it.");
  }
  const event = { sequence, ...input };
  // Round-trip through the strict parser rejects unknown/missing business fields.
  return parseIdeaEvents(serializeIdeaEvents([event], options), options)[0];
}

/** @pure */
export function assertHumanGate(event, idea, primaryWorlds, confirmed) {
  const decision = DECISIONS[event.type];
  if (!decision && !["abandon", "resume"].includes(event.type)) return;
  if (!confirmed) throw new Error("This event requires an explicit human decision; --confirm-decision asserts one, it does not create authorization.");
  if (!decision) return;
  const [revision, state] = decision;
  if (idea.state !== state || event.payload[revision] !== idea.revisions[revision]
    || event.payload[revision] !== primaryWorlds[revision]) {
    throw new Error(`Decision requires ${state} and its exact world revision already synchronized to primary.`);
  }
}

/** @pure */
export function planProjectedAppend(before, paths, event, options) {
  const record = Buffer.from(serializeIdeaEvents([event], options));
  if (record.length > MAX_EVENT_BYTES) throw new Error(`Event exceeds ${MAX_EVENT_BYTES} bytes including LF.`);
  const reduction = reduceIdeaEvent(before.state, event, options);
  if (!reduction.ok) return { record, reduction };
  const full = before.state.sequence % EVENTS_PER_SEGMENT === 0 && before.state.sequence !== 0;
  const name = full ? segmentName(before.entries.length + 1) : before.tail.name.slice(paths.eventsDirectory.length + 1);
  const bytes = full ? record : Buffer.concat([before.tail.bytes, record]);
  const entries = before.entries.map((entry) => ({
    name: entry.name.slice(paths.eventsDirectory.length + 1), object: entry.object,
  }));
  const next = { name, object: gitContentDigest("blob", bytes, options) };
  if (full) entries.push(next);
  else entries[entries.length - 1] = next;
  return {
    record, reduction, digest: eventFolderDigest(entries, options), files: [{
      path: `${paths.eventsDirectory}/${name}`, before: full ? null : before.tail.bytes, after: bytes,
    }]
  };
}

/** @pure */
export function planFullEventChange({ operation, input, bytes, id, ownedSuffix }, options) {
  let candidate;
  let proposed;
  if (operation === "append") {
    const before = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
    if (!before.ok) throw new Error(`Current log reduction failed: ${before.code}; inspect primary and use revise for authorized repair.`);
    proposed = [parseRequest(input, before.state.sequence + 1, options)];
    candidate = Buffer.concat([bytes, Buffer.from(serializeIdeaEvents(proposed, options))]);
  } else {
    if (!ownedSuffix || !Array.isArray(input)) throw new Error("Revise requires --owned-suffix and an array of reviewed business requests for the complete resulting log.");
    proposed = input.map((request, index) => parseRequest(request, index + 1, options));
    candidate = Buffer.from(serializeIdeaEvents(proposed, options));
  }
  const reduction = replayIdeaEvents(id, parseIdeaEvents(candidate, options), options);

  return { candidate, reduction };
}

/** @pure */
export function assertIntroducedDecisions({
  id, operation, bytes, candidate, revisions, primaryWorlds, confirmed,
}, options) {
  let oldEvents = [];
  try { oldEvents = parseIdeaEvents(bytes, options); }
  catch (error) {
    if (operation !== "revise" || !(error instanceof IdeaEventFormatError)) throw error;
    // The valid primary prefix is still enforced by inspectEventHistory.
  }
  const candidateEvents = parseIdeaEvents(candidate, options);
  let oldPosition = 0;
  for (let index = 0; index < candidateEvents.length; index++) {
    const event = candidateEvents[index];
    const businessRecord = (value) => serializeIdeaEvents([{ ...value, sequence: 1 }], options);
    const preserved = oldEvents.findIndex((old, position) =>
      position >= oldPosition && businessRecord(old) === businessRecord(event));
    if (preserved >= 0) {
      oldPosition = preserved + 1;
      continue;
    }
    const before = replayIdeaEvents(id, candidateEvents.slice(0, index), options).state;
    assertHumanGate(event, {
      revisions,
      state: deriveIdeaState(revisions, { version: 1, ...before.status }),
    }, primaryWorlds, confirmed);
  }

}
