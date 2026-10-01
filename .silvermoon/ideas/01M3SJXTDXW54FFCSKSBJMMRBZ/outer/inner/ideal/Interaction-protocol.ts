/**
 * Ideal World contract for local ping/pong interaction events.
 *
 * This file is a reviewable protocol design, not the runtime implementation.
 * Persistence, canonical serialization, parent validation, append-only checks,
 * and migration remain owned by event-state-model.
 */

export type Ulid = string;
export type GitObjectId = string;
export type Rfc3339Timestamp = string;

/**
 * Exact in-memory projection previously represented by status.yaml.
 * Interaction events preserve these fields and extend the same idea state.
 */
export interface LegacyStatusProjection {
  readonly version: 1;
  readonly id: Ulid;
  readonly alias?: string;
  readonly language?: string;
  readonly abandoned?: true;
  readonly approvedRevision?: GitObjectId;
  readonly implementationAcceptedRevision?: GitObjectId;
  readonly deploymentAcceptedRevision?: GitObjectId;
}

export type InstructionStatus =
  | "queued"
  | "delivered"
  | "processing"
  | "responded";

export type PongOutcome =
  | "result"
  | "needs-input"
  | "blocked"
  | "git-failure"
  | "runtime-failure"
  | "sign-off";

export interface EvidenceReference {
  readonly kind: "repository" | "external" | "message";
  readonly reference: string;
  readonly commit?: GitObjectId;
}

export interface InstructionState {
  readonly instructionId: Ulid;
  readonly idempotencyKey: string;
  readonly instruction: string;
  readonly executionContextId: string;
  readonly status: InstructionStatus;
  readonly statusEventId: Ulid;
  readonly responseId?: Ulid;
  readonly evidence: readonly EvidenceReference[];
}

export interface PongState {
  readonly responseId: Ulid;
  readonly instructionIds: readonly Ulid[];
  readonly outcome: PongOutcome;
  readonly summary: string;
  readonly awaitingUpstream: boolean;
  readonly stateEventId: Ulid;
  readonly evidence: readonly EvidenceReference[];
}

export interface InteractionProjection {
  readonly executionContextId: string | null;
  readonly instructions: Readonly<Record<Ulid, InstructionState>>;
  readonly instructionIdByIdempotencyKey: Readonly<Record<string, Ulid>>;
  readonly pongs: Readonly<Record<Ulid, PongState>>;
}

export interface IdeaStateProjection {
  readonly status: LegacyStatusProjection;
  readonly interaction: InteractionProjection;
}

export type InteractionEventType =
  | "interaction.ping.appended"
  | "interaction.instructions.delivered"
  | "interaction.instructions.processing"
  | "interaction.pong.returned";

/**
 * Reducer-facing subset of the shared event-state-model envelope.
 * The implementation must import the shared envelope rather than define a
 * second persistence schema.
 */
export interface InteractionEventEnvelope<
  TType extends InteractionEventType,
  TPayload,
> {
  readonly schemaVersion: 2;
  readonly eventId: Ulid;
  readonly ideaId: Ulid;
  readonly type: TType;
  readonly parents: readonly Ulid[];
  readonly recordedAt: Rfc3339Timestamp;
  readonly payload: TPayload;
}

export interface PongAcknowledgement {
  readonly responseId: Ulid;
  readonly expectedStateEventId: Ulid;
}

export interface PingAppendedPayload {
  readonly instructionId: Ulid;
  readonly idempotencyKey: string;
  readonly executionContextId: string;
  readonly instruction: string;
  readonly acknowledges: readonly PongAcknowledgement[];
  readonly evidence: readonly EvidenceReference[];
}

export interface InstructionTransitionTarget<
  TStatus extends InstructionStatus,
> {
  readonly instructionId: Ulid;
  readonly expectedStatus: TStatus;
  readonly expectedStatusEventId: Ulid;
}

export interface InstructionsDeliveredPayload {
  readonly executionContextId: string;
  readonly targets: readonly InstructionTransitionTarget<"queued">[];
  readonly evidence: readonly EvidenceReference[];
}

export interface InstructionsProcessingPayload {
  readonly executionContextId: string;
  readonly targets: readonly InstructionTransitionTarget<"delivered">[];
  readonly evidence: readonly EvidenceReference[];
}

export interface PongReturnedPayload {
  readonly responseId: Ulid;
  readonly executionContextId: string;
  readonly targets: readonly InstructionTransitionTarget<
    "delivered" | "processing"
  >[];
  readonly outcome: PongOutcome;
  readonly summary: string;
  readonly evidence: readonly EvidenceReference[];
}

export type PingAppendedEvent = InteractionEventEnvelope<
  "interaction.ping.appended",
  PingAppendedPayload
>;

export type InstructionsDeliveredEvent = InteractionEventEnvelope<
  "interaction.instructions.delivered",
  InstructionsDeliveredPayload
>;

export type InstructionsProcessingEvent = InteractionEventEnvelope<
  "interaction.instructions.processing",
  InstructionsProcessingPayload
>;

export type PongReturnedEvent = InteractionEventEnvelope<
  "interaction.pong.returned",
  PongReturnedPayload
>;

export type InteractionEvent =
  | PingAppendedEvent
  | InstructionsDeliveredEvent
  | InstructionsProcessingEvent
  | PongReturnedEvent;

export type TransitionErrorCode =
  | "duplicate-input"
  | "incomplete-event"
  | "unknown-instruction"
  | "stale-transition"
  | "wrong-context";

export class InteractionTransitionError extends Error {
  readonly code: TransitionErrorCode;

  constructor(code: TransitionErrorCode, message: string) {
    super(message);
    this.name = "InteractionTransitionError";
    this.code = code;
  }
}

export function createEmptyInteractionProjection(): InteractionProjection {
  return {
    executionContextId: null,
    instructions: {},
    instructionIdByIdempotencyKey: {},
    pongs: {},
  };
}

/**
 * Applies exactly one accepted event.
 *
 * A duplicate command is resolved before append by returning its existing
 * result. Passing it here therefore fails rather than producing a no-op event.
 */
export function transitionIdeaState(
  state: IdeaStateProjection,
  event: InteractionEvent,
): IdeaStateProjection {
  if (event.ideaId !== state.status.id) {
    throw new InteractionTransitionError(
      "incomplete-event",
      `Event idea ${event.ideaId} does not match ${state.status.id}.`,
    );
  }

  const interaction = cloneInteraction(state.interaction);

  switch (event.type) {
    case "interaction.ping.appended":
      applyPing(interaction, event);
      break;
    case "interaction.instructions.delivered":
      applyInstructionTransition(
        interaction,
        event,
        "queued",
        "delivered",
      );
      break;
    case "interaction.instructions.processing":
      applyInstructionTransition(
        interaction,
        event,
        "delivered",
        "processing",
      );
      break;
    case "interaction.pong.returned":
      applyPong(interaction, event);
      break;
  }

  return {
    status: state.status,
    interaction,
  };
}

export function deriveInteractionReadiness(
  state: InteractionProjection,
): {
  readonly hasRunnableInstructions: boolean;
  readonly hasOpenPongs: boolean;
} {
  return {
    hasRunnableInstructions: Object.values(state.instructions).some(
      ({ status }) => status !== "responded",
    ),
    hasOpenPongs: Object.values(state.pongs).some(
      ({ awaitingUpstream }) => awaitingUpstream,
    ),
  };
}

interface MutableInteractionProjection {
  executionContextId: string | null;
  instructions: Record<Ulid, InstructionState>;
  instructionIdByIdempotencyKey: Record<string, Ulid>;
  pongs: Record<Ulid, PongState>;
}

function cloneInteraction(
  state: InteractionProjection,
): MutableInteractionProjection {
  return {
    executionContextId: state.executionContextId,
    instructions: { ...state.instructions },
    instructionIdByIdempotencyKey: {
      ...state.instructionIdByIdempotencyKey,
    },
    pongs: { ...state.pongs },
  };
}

function applyPing(
  state: MutableInteractionProjection,
  event: PingAppendedEvent,
): void {
  const { payload } = event;
  requireText(payload.instructionId, "instructionId");
  requireText(payload.idempotencyKey, "idempotencyKey");
  requireText(payload.executionContextId, "executionContextId");
  requireText(payload.instruction, "instruction");

  if (state.instructions[payload.instructionId]) {
    throw new InteractionTransitionError(
      "duplicate-input",
      `Instruction ${payload.instructionId} already exists.`,
    );
  }

  const duplicateInstructionId =
    state.instructionIdByIdempotencyKey[payload.idempotencyKey];
  if (duplicateInstructionId) {
    throw new InteractionTransitionError(
      "duplicate-input",
      `Idempotency key already identifies ${duplicateInstructionId}.`,
    );
  }

  requireContext(state, payload.executionContextId);
  requireUnique(
    payload.acknowledges.map(({ responseId }) => responseId),
    "acknowledges",
  );

  for (const acknowledgement of payload.acknowledges) {
    const pong = state.pongs[acknowledgement.responseId];
    if (
      !pong ||
      !pong.awaitingUpstream ||
      pong.stateEventId !== acknowledgement.expectedStateEventId
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `Pong ${acknowledgement.responseId} is absent, closed, or changed.`,
      );
    }
    state.pongs[acknowledgement.responseId] = {
      ...pong,
      awaitingUpstream: false,
      stateEventId: event.eventId,
    };
  }

  state.instructions[payload.instructionId] = {
    instructionId: payload.instructionId,
    idempotencyKey: payload.idempotencyKey,
    instruction: payload.instruction,
    executionContextId: payload.executionContextId,
    status: "queued",
    statusEventId: event.eventId,
    evidence: payload.evidence,
  };
  state.instructionIdByIdempotencyKey[payload.idempotencyKey] =
    payload.instructionId;
}

function applyInstructionTransition(
  state: MutableInteractionProjection,
  event: InstructionsDeliveredEvent | InstructionsProcessingEvent,
  expectedStatus: "queued" | "delivered",
  nextStatus: "delivered" | "processing",
): void {
  requireContext(state, event.payload.executionContextId);
  requireTargets(event.payload.targets);

  for (const target of event.payload.targets) {
    const instruction = requireInstruction(state, target.instructionId);
    if (
      instruction.status !== expectedStatus ||
      target.expectedStatus !== expectedStatus ||
      instruction.statusEventId !== target.expectedStatusEventId
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `Instruction ${target.instructionId} is not at the expected state.`,
      );
    }
  }

  for (const target of event.payload.targets) {
    const instruction = state.instructions[target.instructionId];
    state.instructions[target.instructionId] = {
      ...instruction,
      status: nextStatus,
      statusEventId: event.eventId,
      evidence: [...instruction.evidence, ...event.payload.evidence],
    };
  }
}

function applyPong(
  state: MutableInteractionProjection,
  event: PongReturnedEvent,
): void {
  const { payload } = event;
  requireText(payload.responseId, "responseId");
  requireText(payload.summary, "summary");
  requireContext(state, payload.executionContextId);
  requireTargets(payload.targets);

  if (state.pongs[payload.responseId]) {
    throw new InteractionTransitionError(
      "duplicate-input",
      `Pong ${payload.responseId} already exists.`,
    );
  }

  for (const target of payload.targets) {
    const instruction = requireInstruction(state, target.instructionId);
    if (
      instruction.status !== target.expectedStatus ||
      (instruction.status !== "delivered" &&
        instruction.status !== "processing") ||
      instruction.statusEventId !== target.expectedStatusEventId
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `Instruction ${target.instructionId} cannot receive this pong.`,
      );
    }
  }

  for (const target of payload.targets) {
    const instruction = state.instructions[target.instructionId];
    state.instructions[target.instructionId] = {
      ...instruction,
      status: "responded",
      statusEventId: event.eventId,
      responseId: payload.responseId,
      evidence: [...instruction.evidence, ...payload.evidence],
    };
  }

  state.pongs[payload.responseId] = {
    responseId: payload.responseId,
    instructionIds: payload.targets.map(({ instructionId }) => instructionId),
    outcome: payload.outcome,
    summary: payload.summary,
    awaitingUpstream: payload.outcome !== "result",
    stateEventId: event.eventId,
    evidence: payload.evidence,
  };
}

function requireContext(
  state: MutableInteractionProjection,
  executionContextId: string,
): void {
  requireText(executionContextId, "executionContextId");
  if (state.executionContextId === null) {
    state.executionContextId = executionContextId;
    return;
  }
  if (state.executionContextId !== executionContextId) {
    throw new InteractionTransitionError(
      "wrong-context",
      `Expected execution context ${state.executionContextId}.`,
    );
  }
}

function requireInstruction(
  state: MutableInteractionProjection,
  instructionId: Ulid,
): InstructionState {
  const instruction = state.instructions[instructionId];
  if (!instruction) {
    throw new InteractionTransitionError(
      "unknown-instruction",
      `Instruction ${instructionId} does not exist.`,
    );
  }
  return instruction;
}

function requireTargets(
  targets: readonly InstructionTransitionTarget<InstructionStatus>[],
): void {
  if (targets.length === 0) {
    throw new InteractionTransitionError(
      "incomplete-event",
      "A transition event must target at least one instruction.",
    );
  }
  requireUnique(
    targets.map(({ instructionId }) => instructionId),
    "targets",
  );
}

function requireUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new InteractionTransitionError(
      "incomplete-event",
      `${field} contains duplicate identifiers.`,
    );
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InteractionTransitionError(
      "incomplete-event",
      `${field} must not be empty.`,
    );
  }
}
