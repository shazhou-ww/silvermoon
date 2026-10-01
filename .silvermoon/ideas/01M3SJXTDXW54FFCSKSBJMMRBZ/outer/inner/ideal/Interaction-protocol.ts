/**
 * 理想世界中的本地 ping/pong 协议设计，不是运行时实现。
 * 规范序列化、历史前缀校验和迁移继续由 event-state-model 负责。
 */

export type Ulid = string;
export type GitObjectId = string;

/** 现有 v2 事件归约的 status 投影；世界 revision 仍由观察提供。 */
export interface StatusProjection {
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
  readonly statusSequence: number;
  readonly responseId?: Ulid;
  readonly evidence: readonly EvidenceReference[];
}

export interface PongState {
  readonly responseId: Ulid;
  readonly instructionIds: readonly Ulid[];
  readonly outcome: PongOutcome;
  readonly summary: string;
  readonly awaitingUpstream: boolean;
  readonly stateSequence: number;
  readonly evidence: readonly EvidenceReference[];
}

export interface InteractionProjection {
  readonly executionContextId: string | null;
  readonly instructions: Readonly<Record<Ulid, InstructionState>>;
  readonly instructionIdByIdempotencyKey: Readonly<Record<string, Ulid>>;
  readonly pongs: Readonly<Record<Ulid, PongState>>;
}

export interface IdeaStateProjection {
  readonly status: StatusProjection;
  readonly sequence: number;
  readonly interaction: InteractionProjection;
}

export type InteractionEventType =
  | "interaction.ping.appended"
  | "interaction.instructions.delivered"
  | "interaction.instructions.processing"
  | "interaction.pong.returned";

/** 现有 v2 记录的类型视图；实施时扩展共享事件联合类型，不另建 envelope。 */
export interface InteractionEventEnvelope<
  TType extends InteractionEventType,
  TPayload,
> {
  readonly sequence: number;
  readonly type: TType;
  readonly payload: TPayload;
}

export interface PongAcknowledgement {
  readonly responseId: Ulid;
  readonly expectedStateSequence: number;
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
  readonly expectedStatusSequence: number;
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
  | "sequence-conflict"
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
    instructions: Object.create(null) as Record<Ulid, InstructionState>,
    instructionIdByIdempotencyKey: Object.create(null) as Record<string, Ulid>,
    pongs: Object.create(null) as Record<Ulid, PongState>,
  };
}

export function createInitialIdeaState(ideaId: Ulid): IdeaStateProjection {
  return {
    status: { id: ideaId },
    sequence: 0,
    interaction: createEmptyInteractionProjection(),
  };
}

/** 重试由追加入口返回既有结果；重复事件在归约时拒绝。 */
export function transitionIdeaState(
  state: IdeaStateProjection,
  event: InteractionEvent,
): IdeaStateProjection {
  if (!Number.isSafeInteger(event.sequence) || event.sequence !== state.sequence + 1) {
    throw new InteractionTransitionError(
      "sequence-conflict",
      `事件序号必须是 ${state.sequence + 1}。`,
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
    sequence: event.sequence,
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
    instructions: Object.assign(Object.create(null), state.instructions),
    instructionIdByIdempotencyKey: Object.assign(
      Object.create(null),
      state.instructionIdByIdempotencyKey,
    ),
    pongs: Object.assign(Object.create(null), state.pongs),
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
      `指令 ${payload.instructionId} 已存在。`,
    );
  }

  const duplicateInstructionId =
    state.instructionIdByIdempotencyKey[payload.idempotencyKey];
  if (duplicateInstructionId) {
    throw new InteractionTransitionError(
      "duplicate-input",
      `去重键已对应指令 ${duplicateInstructionId}。`,
    );
  }

  requireContext(state, payload.executionContextId);
  requireUnique(
    payload.acknowledges.map(({ responseId }) => responseId),
    "acknowledges",
  );

  for (const acknowledgement of payload.acknowledges) {
    requireSequence(acknowledgement.expectedStateSequence, "expectedStateSequence");
    const pong = state.pongs[acknowledgement.responseId];
    if (
      !pong ||
      !pong.awaitingUpstream ||
      pong.stateSequence !== acknowledgement.expectedStateSequence
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `响应 ${acknowledgement.responseId} 不存在、已关闭或已变化。`,
      );
    }
    state.pongs[acknowledgement.responseId] = {
      ...pong,
      awaitingUpstream: false,
      stateSequence: event.sequence,
    };
  }

  state.instructions[payload.instructionId] = {
    instructionId: payload.instructionId,
    idempotencyKey: payload.idempotencyKey,
    instruction: payload.instruction,
    executionContextId: payload.executionContextId,
    status: "queued",
    statusSequence: event.sequence,
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
    requireSequence(target.expectedStatusSequence, "expectedStatusSequence");
    const instruction = requireInstruction(state, target.instructionId);
    if (
      instruction.status !== expectedStatus ||
      target.expectedStatus !== expectedStatus ||
      instruction.statusSequence !== target.expectedStatusSequence
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `指令 ${target.instructionId} 不在预期状态。`,
      );
    }
  }

  for (const target of event.payload.targets) {
    const instruction = state.instructions[target.instructionId];
    state.instructions[target.instructionId] = {
      ...instruction,
      status: nextStatus,
      statusSequence: event.sequence,
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
      `响应 ${payload.responseId} 已存在。`,
    );
  }

  for (const target of payload.targets) {
    requireSequence(target.expectedStatusSequence, "expectedStatusSequence");
    const instruction = requireInstruction(state, target.instructionId);
    if (
      instruction.status !== target.expectedStatus ||
      (instruction.status !== "delivered" &&
        instruction.status !== "processing") ||
      instruction.statusSequence !== target.expectedStatusSequence
    ) {
      throw new InteractionTransitionError(
        "stale-transition",
        `指令 ${target.instructionId} 不能接收该响应。`,
      );
    }
  }

  for (const target of payload.targets) {
    const instruction = state.instructions[target.instructionId];
    state.instructions[target.instructionId] = {
      ...instruction,
      status: "responded",
      statusSequence: event.sequence,
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
    stateSequence: event.sequence,
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
      `预期执行上下文为 ${state.executionContextId}。`,
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
      `指令 ${instructionId} 不存在。`,
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
      "转换事件至少需要一个目标指令。",
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
      `${field} 包含重复标识。`,
    );
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InteractionTransitionError(
      "incomplete-event",
      `${field} 不能为空。`,
    );
  }
}

function requireSequence(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InteractionTransitionError(
      "incomplete-event",
      `${field} 必须是正安全整数。`,
    );
  }
}
