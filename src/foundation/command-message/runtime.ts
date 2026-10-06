import {
  buildReport,
  clone,
  completionFactType,
  deepFreeze,
  DOMAIN_MESSAGE_SCHEMA_VERSION,
  DomainInvariantError,
  initialInternalObservation,
  reduceObservation,
  responseMetadata,
} from "./observation.ts";
import type {
  ActionRequest,
  CommandProgress,
  DomainMessage,
  InternalObservation,
  ObservationFact,
} from "./observation.ts";
import { emitDomainMessage, traceAsync } from "../trace/index.ts";
import type {
  CommandIntention,
  Observation,
  Problem,
  ResponseContext,
} from "../report/types.ts";

type DomainMessagePayload = DomainMessage extends infer Message
  ? Message extends DomainMessage
    ? Omit<Message, "schemaVersion" | "sequence">
    : never
  : never;

interface ActionSuccess<Result extends object> {
  status: "success";
  result: Result;
  facts?: ObservationFact[];
}

interface ActionFailure<Internal extends object = Record<never, never>> {
  status: "failure";
  problem: Problem;
  facts?: ObservationFact[];
  internal?: Internal;
}

type ActionCompletion<
  Result extends object,
  Internal extends object = Record<never, never>,
> = ActionSuccess<Result> | ActionFailure<Internal>;

interface ActionFailureMapping<Internal extends object> {
  problem: Problem;
  facts?: ObservationFact[];
  internal?: Internal;
}

interface ObserveOptions {
  factType?: string;
  progress?: CommandProgress;
  responseContext?: ResponseContext;
}

interface CompleteOptions {
  factType?: string;
}

interface CommandRunApi {
  eventSink: (message: DomainMessage) => void;
  readonly events: DomainMessage[];
  readonly observation: InternalObservation;
  observe(observation: Observation, options?: ObserveOptions): DomainMessage;
  requestAction(action: ActionRequest): string;
  finishAction(
    actionId: string,
    actionType: string,
    completion: ActionCompletion<object, object>,
  ): DomainMessage;
  performAction<
    Result extends object,
    ProjectedResult extends object = Result,
    Internal extends object = Record<never, never>,
  >(
    action: ActionRequest,
    execute: (context: { actionId: string }) => Result | Promise<Result>,
    mapError?: (caught: unknown) => ActionFailureMapping<Internal>,
    mapSuccess?: (completed: Result) => {
      result: ProjectedResult;
      facts?: ObservationFact[];
    },
  ): Promise<ActionCompletion<Result | ProjectedResult, Internal>>;
  finish(): ReturnType<typeof buildReport>;
  complete(
    observation: Observation,
    responseContext?: ResponseContext,
    options?: CompleteOptions,
  ): ReturnType<typeof buildReport>;
}

interface CreateCommandRunOptions {
  eventSink?: (message: DomainMessage) => void;
  dispatch?: CommandRunApi;
  onReady?: (run: CommandRunApi) => void;
}

export function createCommandRun(
  intention: CommandIntention,
  {
    eventSink = emitDomainMessage,
    dispatch,
    onReady,
  }: CreateCommandRunOptions = {},
): CommandRunApi {
  const events: DomainMessage[] = [];
  let nextActionId = 1;
  let state = initialInternalObservation();

  function emit(message: DomainMessagePayload): DomainMessage {
    const event = deepFreeze({
      schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
      sequence: events.length + 1,
      ...clone(message),
    });
    state = reduceObservation(state, event);
    events.push(event);
    run.eventSink(event);
    return event;
  }

  const run: CommandRunApi = {
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
      if (completion.status === "success") {
        return emit({
          type: "action.finished",
          actionId,
          actionType,
          status: "success",
          result: completion.result,
          facts: completion.facts ?? [],
        });
      }
      return emit({
        type: "action.finished",
        actionId,
        actionType,
        status: "failure",
        problem: completion.problem,
        facts: completion.facts ?? [],
      });
    },

    async performAction<
      Result extends object,
      ProjectedResult extends object = Result,
      Internal extends object = Record<never, never>,
    >(
      action: ActionRequest,
      execute: (context: { actionId: string }) => Result | Promise<Result>,
      mapError?: (caught: unknown) => ActionFailureMapping<Internal>,
      mapSuccess?: (completed: Result) => {
        result: ProjectedResult;
        facts?: ObservationFact[];
      },
    ): Promise<ActionCompletion<Result | ProjectedResult, Internal>> {
      const actionId = commands.requestAction(action);
      const operation = async (): Promise<
        ActionCompletion<Result | ProjectedResult, Internal>
      > => {
        try {
          const executed = await execute({ actionId });
          const mapped = mapSuccess?.(executed);
          const completion: ActionSuccess<Result | ProjectedResult> = {
            status: "success",
            result: mapped?.result ?? executed,
            facts: mapped?.facts ?? [],
          };
          commands.finishAction(actionId, action.type, completion);
          return completion;
        } catch (caught) {
          const mapped = mapError?.(caught);
          const completion: ActionFailure<Internal> = {
            status: "failure",
            problem: mapped?.problem ?? {
              type: "unexpected-action-failure",
              summary: caught instanceof Error ? caught.name : typeof caught,
            },
            facts: mapped?.facts ?? [],
            ...(mapped?.internal === undefined
              ? {}
              : { internal: mapped.internal }),
          };
          commands.finishAction(actionId, action.type, completion);
          if (mapped === undefined) throw caught;
          return completion;
        }
      };
      return traceAsync(
        `action.${action.type}`,
        { actionId, actionType: action.type },
        operation,
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
      const progress = observation.problems.length > 0 ? "blocked" : "ready";
      const acceptedIntention = state.intention;
      if (acceptedIntention === null) {
        throw new DomainInvariantError(
          "Cannot complete a command before accepting its intention",
        );
      }
      commands.observe(observation, {
        factType: factType
          ?? completionFactType(acceptedIntention, observation),
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

export class CommandRun implements CommandRunApi {
  #run: CommandRunApi | undefined;
  eventSink: (message: DomainMessage) => void;

  constructor(
    intention: CommandIntention,
    { eventSink = emitDomainMessage }: Pick<CreateCommandRunOptions, "eventSink"> = {},
  ) {
    this.eventSink = eventSink;
    this.#run = createCommandRun(intention, {
      eventSink: (event) => this.eventSink(event),
      dispatch: this,
      onReady: (run) => {
        this.#run = run;
      },
    });
  }

  #getRun(): CommandRunApi {
    if (this.#run === undefined) {
      throw new DomainInvariantError("Command run is not initialized");
    }
    return this.#run;
  }

  get events() {
    return this.#getRun().events;
  }

  get observation() {
    return this.#getRun().observation;
  }

  observe(observation: Observation, options: ObserveOptions = {}) {
    return this.#getRun().observe(observation, options);
  }

  requestAction(action: ActionRequest) {
    return this.#getRun().requestAction(action);
  }

  finishAction(
    actionId: string,
    actionType: string,
    completion: ActionCompletion<object, object>,
  ) {
    return this.#getRun().finishAction(actionId, actionType, completion);
  }

  performAction<
    Result extends object,
    ProjectedResult extends object = Result,
    Internal extends object = Record<never, never>,
  >(
    action: ActionRequest,
    execute: (context: { actionId: string }) => Result | Promise<Result>,
    mapError?: (caught: unknown) => ActionFailureMapping<Internal>,
    mapSuccess?: (completed: Result) => {
      result: ProjectedResult;
      facts?: ObservationFact[];
    },
  ) {
    return this.#getRun().performAction(action, execute, mapError, mapSuccess);
  }

  finish() {
    return this.#getRun().finish();
  }

  complete(
    observation: Observation,
    responseContext: ResponseContext = {},
    options: CompleteOptions = {},
  ) {
    return this.#getRun().complete(observation, responseContext, options);
  }
}

interface ResponseDecision {
  type: "response";
  observation?: Observation;
  responseContext?: ResponseContext;
}

interface ProbeDecision {
  type: "probe";
  effect: object;
  factType?: string;
}

interface ActionDecision {
  type: "action";
  effect: ActionRequest;
  mapError?: (caught: unknown) => ActionFailureMapping<object>;
}

type CommandDecision = ResponseDecision | ProbeDecision | ActionDecision;

interface CommandPorts {
  probe(effect: object): Promise<{
    observation: Observation;
    factType?: string;
    progress?: CommandProgress;
    responseContext?: ResponseContext;
  }>;
  action(
    effect: ActionRequest,
    context: { actionId: string },
  ): {
    result?: object;
    facts?: ObservationFact[];
  } | Promise<{
    result?: object;
    facts?: ObservationFact[];
  }>;
}

export async function driveCommand({
  decide,
  intention,
  ports,
  responseContext = {},
}: {
  decide: (
    intention: CommandIntention,
    observation: InternalObservation,
  ) => CommandDecision;
  intention: CommandIntention;
  ports: CommandPorts;
  responseContext?: ResponseContext;
}) {
  const run = createCommandRun(intention);
  for (let step = 0; step < 100; step += 1) {
    const decision = decide(intention, run.observation);
    if (decision.type === "response") {
      if (
        decision.observation === undefined
        && (run.observation.progress === "ready"
          || run.observation.progress === "blocked")
      ) {
        return run.finish();
      }
      const observation = decision.observation ?? run.observation.observation;
      if (observation === null) {
        throw new DomainInvariantError(
          "A response decision requires an observation",
        );
      }
      return run.complete(
        observation,
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
          result: completed.result ?? completed,
          facts: completed.facts ?? [],
        }),
      );
      continue;
    }
  }
  throw new DomainInvariantError("Command driver exceeded 100 decisions");
}
