import { MAX_EVENT_BYTES, gitContentDigest } from "../event-history/index.ts";
import {
  type EventCodecOptions,
  type IdeaEvent,
  type IdeaEventState,
  parseIdeaEvents,
  reduceIdeaEvent,
  replayIdeaEvents,
  serializeIdeaEvents,
} from "../event-codec/index.ts";
import { deriveIdeaState } from "../idea-model/index.ts";

const DECISIONS: Readonly<Record<string, readonly [string, string]>> = {
  acceptIdeal: ["idealRevision", "preparing"],
  acceptInner: ["implementationRevision", "implementing"],
  acceptOuter: ["deploymentRevision", "deploying"],
};

type IdeaRevisions = {
  idealRevision: string;
  implementationRevision: string;
  deploymentRevision: string;
  [key: string]: string;
};

/** @pure */
export function parseRequest(
  input: object|null,
  sequence: number,
  options?: EventCodecOptions,
) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.hasOwn(input, "sequence")) {
    throw new Error("Supply a business request object without sequence; the CLI assigns it.");
  }
  const event = { sequence, ...input };
  // Round-trip through the strict parser rejects unknown/missing business fields.
  return parseIdeaEvents(serializeIdeaEvents([event], options), options)[0];
}

/** @pure */
export function assertHumanGate(
  event: IdeaEvent,
  idea: { revisions: IdeaRevisions; state: string },
  primaryWorlds: Record<string, string|undefined>,
  confirmed: boolean,
) {
  const decision = DECISIONS[event.type];
  if (!decision && !["abandon", "resume"].includes(event.type)) return;
  if (!confirmed) throw new Error("This event requires an explicit human decision; --confirm-decision asserts one, it does not create authorization.");
  if (!decision) return;
  const [revision, state] = decision;
  const eventRevision = "payload" in event ? event.payload[revision] : undefined;
  if (idea.state !== state || eventRevision !== idea.revisions[revision]
    || eventRevision !== primaryWorlds[revision]) {
    throw new Error(`Decision requires ${state} and its exact world revision already synchronized to primary.`);
  }
}

/** @pure */
export function planProjectedAppend(
  before: {
    state: IdeaEventState;
    bytes: Buffer;
  },
  paths: { eventsPath: string },
  event: IdeaEvent,
  options: EventCodecOptions & { objectIdLength: number },
) {
  const record = Buffer.from(serializeIdeaEvents([event], options));
  if (record.length > MAX_EVENT_BYTES) throw new Error(`Event exceeds ${MAX_EVENT_BYTES} bytes including LF.`);
  const reduction = reduceIdeaEvent(before.state, event, options);
  if (!reduction.ok) return { record, reduction };
  const bytes = Buffer.concat([before.bytes, record]);
  return {
    record, reduction, digest: gitContentDigest("blob", bytes, options), files: [{
      path: paths.eventsPath, before: before.bytes, after: bytes,
    }]
  };
}

/** @pure */
export function planFullEventChange(
  { operation, input, bytes, id }: {
    operation: string;
    input: object|null;
    bytes: Buffer;
    id: string;
  },
  options?: EventCodecOptions,
) {
  if (operation !== "append") throw new Error(`Unknown event operation: ${operation}`);
  const before = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
  if (!before.ok) {
    throw new Error(
      `Current log reduction failed: ${before.code}; review the complete events.jsonl directly.`,
    );
  }
  const proposed = [parseRequest(input, before.state.sequence + 1, options)];
  const candidate = Buffer.concat([bytes, Buffer.from(serializeIdeaEvents(proposed, options))]);
  const reduction = replayIdeaEvents(id, parseIdeaEvents(candidate, options), options);

  return { candidate, reduction };
}

/** @pure */
export function assertIntroducedDecisions({
  id, operation, bytes, candidate, revisions, primaryWorlds, confirmed,
}: {
  id: string;
  operation: string;
  bytes: Buffer;
  candidate: Buffer;
  revisions: IdeaRevisions;
  primaryWorlds: Record<string, string|undefined>;
  confirmed: boolean;
}, options?: EventCodecOptions) {
  if (operation !== "append") throw new Error(`Unknown event operation: ${operation}`);
  const oldEvents = parseIdeaEvents(bytes, options);
  const candidateEvents = parseIdeaEvents(candidate, options);
  let oldPosition = 0;
  for (let index = 0; index < candidateEvents.length; index++) {
    const event = candidateEvents[index];
    if (!event) throw new Error("Candidate event is missing.");
    const businessRecord = (value: IdeaEvent) =>
      serializeIdeaEvents([{ ...value, sequence: 1 }], options);
    const preserved = oldEvents.findIndex((old, position) =>
      position >= oldPosition && businessRecord(old) === businessRecord(event));
    if (preserved >= 0) {
      oldPosition = preserved + 1;
      continue;
    }
    const reduction = replayIdeaEvents(id, candidateEvents.slice(0, index), options);
    if (!reduction.ok) {
      throw new Error(`Candidate prefix reduction failed: ${reduction.code}.`);
    }
    const before = reduction.state;
    assertHumanGate(event, {
      revisions,
      state: deriveIdeaState(revisions, { version: 1, ...before.status }),
    }, primaryWorlds, confirmed);
  }

}
