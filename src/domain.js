import { createHash } from "node:crypto";

import { respond } from "./response.js";
import {
  emitDomainMessage,
  traceAsync,
} from "./trace.js";

export const DOMAIN_MESSAGE_SCHEMA_VERSION = 1;

const PROGRESS = new Set(["initial", "accepted", "observing", "ready", "blocked"]);
const TERMINAL_PROGRESS = new Set(["ready", "blocked"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function frozenClone(value) {
  return deepFreeze(clone(value));
}

export class DomainInvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

export function initialInternalObservation() {
  return deepFreeze({
    actions: {},
    intention: null,
    nextSequence: 1,
    observation: null,
    progress: "initial",
    responseContext: null,
    responseKind: null,
    responseMetadata: null,
  });
}

function requireMessage(state, message) {
  if (message?.schemaVersion !== DOMAIN_MESSAGE_SCHEMA_VERSION) {
    throw new DomainInvariantError(
      `Unsupported domain message schema version: ${message?.schemaVersion}`,
    );
  }
  if (message.sequence !== state.nextSequence) {
    throw new DomainInvariantError(
      `Expected domain message sequence ${state.nextSequence}, received ${message.sequence}`,
    );
  }
  if (typeof message.type !== "string" || message.type.length === 0) {
    throw new DomainInvariantError("Domain message type must be a non-empty string");
  }
}

function transitionProgress(current, next) {
  if (!PROGRESS.has(next)) {
    throw new DomainInvariantError(`Unknown command progress: ${next}`);
  }
  if (TERMINAL_PROGRESS.has(current)) {
    throw new DomainInvariantError(
      `Cannot transition command progress from terminal state ${current}`,
    );
  }
  if (current === "initial" && next !== "accepted") {
    throw new DomainInvariantError(
      `Command progress must transition from initial to accepted, not ${next}`,
    );
  }
  if (current === "accepted" && next === "initial") {
    throw new DomainInvariantError("Command progress cannot return to initial");
  }
  return next;
}

function applyObservationFact(state, fact) {
  if (typeof fact?.type !== "string" || fact.type.length === 0) {
    throw new DomainInvariantError("Observation fact type must be a non-empty string");
  }
  if (!fact.observation || typeof fact.observation.state !== "string") {
    throw new DomainInvariantError(
      `${fact.type} requires a structured observation`,
    );
  }
  const progress = transitionProgress(state.progress, fact.progress);
  return {
    ...state,
    observation: frozenClone(fact.observation),
    progress,
    responseContext: frozenClone(fact.responseContext ?? {}),
  };
}

export function reduceObservation(state, message) {
  requireMessage(state, message);
  let next = { ...state, nextSequence: state.nextSequence + 1 };

  if (message.type === "intention.accepted") {
    if (state.intention !== null) {
      throw new DomainInvariantError("A command can accept only one intention");
    }
    if (
      !isRecord(message.intention)
      || typeof message.intention.command !== "string"
      || !isRecord(message.intention.args)
    ) {
      throw new DomainInvariantError(
        "intention.accepted requires a normalized command and args",
      );
    }
    next.intention = frozenClone(message.intention);
    next.progress = transitionProgress(state.progress, "accepted");
    return deepFreeze(next);
  }

  if (state.intention === null) {
    throw new DomainInvariantError(
      "The first domain message must be intention.accepted",
    );
  }

  if (message.type === "observation.fact") {
    next = applyObservationFact(next, message.fact);
    return deepFreeze(next);
  }

  if (message.type === "action.requested") {
    if (TERMINAL_PROGRESS.has(state.progress)) {
      throw new DomainInvariantError("Cannot request an action after a terminal observation");
    }
    if (state.actions[message.actionId] !== undefined) {
      throw new DomainInvariantError(`Duplicate action id: ${message.actionId}`);
    }
    if (!isRecord(message.action) || typeof message.action.type !== "string") {
      throw new DomainInvariantError(
        `Action ${message.actionId} requires a structured request`,
      );
    }
    next.actions = {
      ...state.actions,
      [message.actionId]: {
        status: "requested",
        type: message.action.type,
      },
    };
    return deepFreeze(next);
  }

  if (message.type === "action.finished") {
    const requested = state.actions[message.actionId];
    if (requested === undefined) {
      throw new DomainInvariantError(
        `Action ${message.actionId} finished without being requested`,
      );
    }
    if (requested.status !== "requested") {
      throw new DomainInvariantError(
        `Action ${message.actionId} finished more than once`,
      );
    }
    if (requested.type !== message.actionType) {
      throw new DomainInvariantError(
        `Action ${message.actionId} changed type from ${requested.type} to ${message.actionType}`,
      );
    }
    if (message.status !== "success" && message.status !== "failure") {
      throw new DomainInvariantError(
        `Action ${message.actionId} has invalid status ${message.status}`,
      );
    }
    if (!Array.isArray(message.facts)) {
      throw new DomainInvariantError(
        `Action ${message.actionId} facts must be an array`,
      );
    }
    if (message.status === "success" && !isRecord(message.result)) {
      throw new DomainInvariantError(
        `Successful action ${message.actionId} requires a structured result`,
      );
    }
    if (
      message.status === "failure"
      && (
        !isRecord(message.problem)
        || typeof message.problem.type !== "string"
        || message.problem.type.length === 0
      )
    ) {
      throw new DomainInvariantError(
        `Failed action ${message.actionId} requires a structured problem`,
      );
    }
    next.actions = {
      ...state.actions,
      [message.actionId]: {
        status: message.status,
        type: message.actionType,
      },
    };
    for (const fact of message.facts ?? []) {
      next = applyObservationFact(next, fact);
    }
    return deepFreeze(next);
  }

  if (message.type === "response.created") {
    if (!TERMINAL_PROGRESS.has(state.progress) || state.observation === null) {
      throw new DomainInvariantError(
        "Cannot create a response before a terminal observation",
      );
    }
    if (
      Object.values(state.actions).some(({ status }) => status === "requested")
    ) {
      throw new DomainInvariantError(
        "Cannot create a response while an action is pending",
      );
    }
    if (state.responseKind !== null) {
      throw new DomainInvariantError("A command can create only one response");
    }
    if (
      typeof message.kind !== "string"
      || !isRecord(message.metadata)
      || !/^[0-9a-f]{64}$/.test(message.metadata.hash)
      || !Number.isInteger(message.metadata.nextStepCount)
      || !Number.isInteger(message.metadata.itemCount)
    ) {
      throw new DomainInvariantError(
        "response.created requires a kind and deterministic metadata",
      );
    }
    next.responseKind = message.kind;
    next.responseMetadata = frozenClone(message.metadata);
    return deepFreeze(next);
  }

  throw new DomainInvariantError(`Unknown domain message type: ${message.type}`);
}

export function replayObservation(messages) {
  return messages.reduce(
    (state, message) => reduceObservation(state, message),
    initialInternalObservation(),
  );
}

export function projectIntention(messages) {
  const accepted = messages.filter(({ type }) => type === "intention.accepted");
  if (accepted.length !== 1 || messages[0] !== accepted[0]) {
    throw new DomainInvariantError(
      "A domain stream must begin with exactly one intention.accepted message",
    );
  }
  return clone(accepted[0].intention);
}

export function projectActions(messages, { allowPending = false } = {}) {
  const records = new Map();
  for (const message of messages) {
    if (message.type === "action.requested") {
      if (records.has(message.actionId)) {
        throw new DomainInvariantError(`Duplicate action id: ${message.actionId}`);
      }
      records.set(message.actionId, {
        id: message.actionId,
        type: message.action.type,
        status: "requested",
      });
      continue;
    }
    if (message.type !== "action.finished") continue;
    const record = records.get(message.actionId);
    if (record === undefined) {
      throw new DomainInvariantError(
        `Action ${message.actionId} finished without being requested`,
      );
    }
    if (record.status !== "requested") {
      throw new DomainInvariantError(
        `Action ${message.actionId} finished more than once`,
      );
    }
    if (record.type !== message.actionType) {
      throw new DomainInvariantError(
        `Action ${message.actionId} changed type from ${record.type} to ${message.actionType}`,
      );
    }
    record.status = message.status;
    if (message.status === "success") {
      record.result = clone(message.result ?? {});
    } else {
      record.problem = clone(message.problem);
    }
  }
  if (
    !allowPending
    && [...records.values()].some(({ status }) => status === "requested")
  ) {
    throw new DomainInvariantError("A final report cannot contain a pending action");
  }
  return [...records.values()].map((record) => clone(record));
}

export function projectPublicObservation(internalObservation) {
  const observation = clone(internalObservation);
  if (observation?.guidance?.content !== undefined) {
    const { content: _content, ...provenance } = observation.guidance;
    observation.guidance = provenance;
  }
  return observation;
}

function responseHash(response) {
  return createHash("sha256")
    .update(JSON.stringify(response))
    .digest("hex");
}

function responseMetadata(response) {
  return {
    hash: responseHash(response),
    nextStepCount: response.nextSteps?.length ?? 0,
    itemCount: response.items?.length
      ?? response.choices?.length
      ?? 0,
  };
}

function completionFactType(intention, observation) {
  if (intention.command === "check") {
    return observation.state === "project-ready"
      ? "validation.completed"
      : "validation.failed";
  }
  const byState = {
    "idea-create-failed": "idea.creation-failed",
    "idea-created": "idea.created",
    "idea-not-found": "idea.selection-missed",
    "idea-selected": observation.guidance === undefined
      ? "idea.selected"
      : "guidance.selected",
    "ideas-listed": "ideas.listed",
    "navigation-ready": "idea.navigation-ready",
    "phase-guidance-invalid": "guidance.validation-failed",
    "project-setup-required": "project.readiness-blocked",
    "repository-preparation-required": "repository.readiness-blocked",
    "repository-sync-required": "repository.readiness-blocked",
  };
  return byState[observation.state] ?? "command.completed";
}

function buildReport(messages, { requireResponse = true } = {}) {
  const state = replayObservation(messages);
  if (state.observation === null || !TERMINAL_PROGRESS.has(state.progress)) {
    throw new DomainInvariantError(
      "A final report requires a terminal observation",
    );
  }
  const intention = projectIntention(messages);
  const response = respond(intention, state);
  if (requireResponse && state.responseKind === null) {
    throw new DomainInvariantError(
      "A final report requires one response.created message",
    );
  }
  if (state.responseKind !== null && state.responseKind !== response.kind) {
    throw new DomainInvariantError(
      `Response kind changed from ${state.responseKind} to ${response.kind}`,
    );
  }
  if (
    state.responseMetadata !== null
    && JSON.stringify(state.responseMetadata) !== JSON.stringify(responseMetadata(response))
  ) {
    throw new DomainInvariantError(
      "Response metadata does not match the projected response",
    );
  }
  return {
    intention,
    observation: projectPublicObservation(state.observation),
    actions: projectActions(messages),
    response,
  };
}

export function projectReport(messages) {
  return buildReport(messages);
}

export class CommandRun {
  #events = [];
  #nextActionId = 1;
  #state = initialInternalObservation();

  constructor(intention, { eventSink = emitDomainMessage } = {}) {
    this.eventSink = eventSink;
    this.#emit({
      type: "intention.accepted",
      intention,
    });
  }

  get events() {
    return this.#events.map((event) => clone(event));
  }

  get observation() {
    return this.#state;
  }

  #emit(message) {
    const event = deepFreeze({
      schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
      sequence: this.#events.length + 1,
      ...clone(message),
    });
    const nextState = reduceObservation(this.#state, event);
    this.#events.push(event);
    this.#state = nextState;
    this.eventSink(event);
    return event;
  }

  observe(observation, {
    factType = "command.observation",
    progress = "observing",
    responseContext = {},
  } = {}) {
    return this.#emit({
      type: "observation.fact",
      fact: {
        type: factType,
        observation,
        progress,
        responseContext,
      },
    });
  }

  requestAction(action) {
    if (!action || typeof action.type !== "string" || action.type.length === 0) {
      throw new DomainInvariantError("An action requires a non-empty type");
    }
    const actionId = `action-${this.#nextActionId}`;
    this.#nextActionId += 1;
    this.#emit({
      type: "action.requested",
      actionId,
      action,
    });
    return actionId;
  }

  finishAction(actionId, actionType, completion) {
    return this.#emit({
      type: "action.finished",
      actionId,
      actionType,
      status: completion.status,
      ...(completion.status === "success"
        ? { result: completion.result ?? {} }
        : { problem: completion.problem }),
      facts: completion.facts ?? [],
    });
  }

  async performAction(action, execute, mapError, mapSuccess) {
    const actionId = this.requestAction(action);
    return traceAsync(
      `action.${action.type}`,
      { actionId, actionType: action.type },
      async () => {
        try {
          const executed = await execute({ actionId });
          const mapped = mapSuccess?.(executed);
          const completion = {
            status: "success",
            result: mapped?.result ?? executed ?? {},
            facts: mapped?.facts ?? [],
          };
          this.finishAction(actionId, action.type, completion);
          return completion;
        } catch (caught) {
          const mapped = mapError?.(caught);
          const completion = {
            status: "failure",
            problem: mapped?.problem ?? {
              type: "unexpected-action-failure",
              errorName: caught instanceof Error ? caught.name : typeof caught,
            },
            facts: mapped?.facts ?? [],
            internal: mapped?.internal,
          };
          this.finishAction(actionId, action.type, completion);
          if (mapped === undefined) throw caught;
          return completion;
        }
      },
      (completion) => ({
        status: completion.status === "success" ? "ok" : "error",
      }),
    );
  }

  finish() {
    const report = buildReport(this.#events, { requireResponse: false });
    this.#emit({
      type: "response.created",
      kind: report.response.kind,
      metadata: responseMetadata(report.response),
    });
    return buildReport(this.#events);
  }

  complete(observation, responseContext = {}, { factType } = {}) {
    const progress = observation.problems?.length > 0 ? "blocked" : "ready";
    this.observe(observation, {
      factType: factType
        ?? completionFactType(this.#state.intention, observation),
      progress,
      responseContext,
    });
    return this.finish();
  }
}

export function createCommandRun(intention, options) {
  return new CommandRun(intention, options);
}

export async function driveCommand({
  decide,
  intention,
  ports,
  responseContext = {},
}) {
  const run = createCommandRun(intention);
  for (let step = 0; step < 100; step += 1) {
    const decision = decide(intention, run.observation);
    if (decision.type === "response") {
      if (
        decision.observation === undefined
        && TERMINAL_PROGRESS.has(run.observation.progress)
      ) {
        return run.finish();
      }
      return run.complete(
        decision.observation ?? run.observation.observation,
        decision.responseContext ?? responseContext,
      );
    }
    if (decision.type === "probe") {
      const observed = await ports.probe(decision.effect);
      run.observe(observed.observation, {
        factType: observed.factType ?? decision.factType ?? "command.probe",
        progress: observed.progress ?? "observing",
        responseContext: observed.responseContext ?? {},
      });
      continue;
    }
    if (decision.type === "action") {
      await run.performAction(
        decision.effect,
        ({ actionId }) => ports.action(decision.effect, { actionId }),
        decision.mapError,
        (completed) => ({
          result: completed?.result ?? completed ?? {},
          facts: completed?.facts ?? [],
        }),
      );
      continue;
    }
    throw new DomainInvariantError(`Unknown decision type: ${decision.type}`);
  }
  throw new DomainInvariantError("Command driver exceeded 100 decisions");
}
