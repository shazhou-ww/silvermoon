import {
  buildReport,
  clone,
  completionFactType,
  deepFreeze,
  DOMAIN_MESSAGE_SCHEMA_VERSION, DomainInvariantError, initialInternalObservation,
  reduceObservation,
  responseMetadata,
} from "./command-rules.js";
import { emitDomainMessage, traceAsync } from "./trace.js";

export function createCommandRun(intention, {
  eventSink = emitDomainMessage, dispatch, onReady,
} = {}) {
  const events = [];
  let nextActionId = 1;
  let state = initialInternalObservation();
  function emit(message) {
    const event = deepFreeze({
      schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
      sequence: events.length + 1,
      ...clone(message),
    });
    const nextState = reduceObservation(state, event);
    events.push(event);
    state = nextState;
    run.eventSink(event);
    return event;
  }

  const run = {
    eventSink,

    get events() {
      return events.map((event) => clone(event));
    },

    get observation() {
      return state;
    },

    observe(observation, {
      factType = "command.observation",
      progress = "observing",
      responseContext = {},
    } = {}) {
      return emit({
        type: "observation.fact",
        fact: {
          type: factType,
          observation,
          progress,
          responseContext,
        },
      });
    },

    requestAction(action) {
      if (!action || typeof action.type !== "string" || action.type.length === 0) {
        throw new DomainInvariantError("An action requires a non-empty type");
      }
      const actionId = `action-${nextActionId}`;
      nextActionId += 1;
      emit({
        type: "action.requested",
        actionId,
        action,
      });
      return actionId;
    },

    finishAction(actionId, actionType, completion) {
      return emit({
        type: "action.finished",
        actionId,
        actionType,
        status: completion.status,
        ...(completion.status === "success"
          ? { result: completion.result ?? {} }
          : { problem: completion.problem }),
        facts: completion.facts ?? [],
      });
    },

    async performAction(action, execute, mapError, mapSuccess) {
      const actionId = commands.requestAction(action);
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
            commands.finishAction(actionId, action.type, completion);
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
            commands.finishAction(actionId, action.type, completion);
            if (mapped === undefined) throw caught;
            return completion;
          }
        },
        (completion) => ({
          status: completion.status === "success" ? "ok" : "error",
        }),
      );
    },

    finish() {
      const report = buildReport(events, { requireResponse: false });
      emit({
        type: "response.created",
        kind: report.response.kind,
        metadata: responseMetadata(report.response),
      });
      return buildReport(events);
    },

    complete(observation, responseContext = {}, { factType } = {}) {
      const progress = observation.problems?.length > 0 ? "blocked" : "ready";
      commands.observe(observation, {
        factType: factType
          ?? completionFactType(state.intention, observation),
        progress,
        responseContext,
      });
      return commands.finish();
    },
  };
  const commands = dispatch ?? run;
  onReady?.(run);
  emit({ type: "intention.accepted", intention });
  return run;
}

export class CommandRun {
  #run;
  constructor(intention, { eventSink = emitDomainMessage } = {}) {
    this.eventSink = eventSink;
    this.#run = createCommandRun(intention, {
      eventSink: (event) => this.eventSink(event),
      dispatch: this,
      onReady: (run) => { this.#run = run; },
    });
  }
  get events() {
    return this.#run.events;
  }
  get observation() {
    return this.#run.observation;
  }
  observe(observation, options = {}) {
    return this.#run.observe(observation, options);
  }
  requestAction(action) {
    return this.#run.requestAction(action);
  }
  finishAction(actionId, actionType, completion) {
    return this.#run.finishAction(actionId, actionType, completion);
  }
  performAction(action, execute, mapError, mapSuccess) {
    return this.#run.performAction(action, execute, mapError, mapSuccess);
  }
  finish() {
    return this.#run.finish();
  }
  complete(observation, responseContext = {}, options = {}) {
    return this.#run.complete(observation, responseContext, options);
  }
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
        && ["ready", "blocked"].includes(run.observation.progress)
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
