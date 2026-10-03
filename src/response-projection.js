import {
  DEFAULT_LANGUAGE,
  localize,
  resolveOutputLanguage,
} from "./language.js";

const BLOCKED_STATES = new Set([
  "check-unavailable",
  "idea-create-failed",
  "phase-guidance-invalid",
  "project-setup-required",
  "repository-preparation-required",
  "repository-sync-required",
]);

/** @pure */
function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

/** @pure */
function responseLanguage(intention, observation) {
  return observation.outputLanguage
    ?? resolveOutputLanguage({
      content: observation.configuration?.preferredLanguage,
      override: intention.args?.language ?? undefined,
    }).tag
    ?? DEFAULT_LANGUAGE;
}

/** @pure */
function normalizeNextSteps(nextSteps) {
  if (nextSteps === undefined || nextSteps === null || nextSteps === "") {
    return [];
  }
  const values = Array.isArray(nextSteps) ? nextSteps : [nextSteps];
  return values.map((step) =>
    typeof step === "string"
      ? { type: "instruction", text: step }
      : clone(step)
  );
}

/** @pure */
function observationDetails(observation) {
  const details = {};
  if (observation.root !== undefined) details.root = observation.root;
  if (observation.version !== undefined) details.version = clone(observation.version);
  if (observation.configuration !== undefined) {
    details.primary = {
      repository: observation.configuration.primaryRepository,
      branch: observation.configuration.primaryBranch,
    };
    details.contentLanguage = observation.configuration.preferredLanguage;
  }
  return details;
}

/** @pure */
function blockedSummary(command, observation, language) {
  const summaries = {
    "check-unavailable": localize(
      language,
      "The requested repository snapshot could not be validated.",
      "无法验证请求的 repository snapshot。",
    ),
    "idea-create-failed": localize(
      language,
      "The repository was ready, but creating the idea failed.",
      "repository 已就绪，但创建 idea 失败。",
    ),
    "phase-guidance-invalid": localize(
      language,
      "The current phase guidance is invalid.",
      "当前阶段 guidance 无效。",
    ),
    "project-setup-required": localize(
      language,
      "The project requires Silvermoon setup.",
      "项目需要完成 Silvermoon 整备。",
    ),
    "repository-preparation-required": localize(
      language,
      "The local repository must be prepared before creating an idea.",
      "创建 idea 前必须先整备本地 repository。",
    ),
    "repository-sync-required": localize(
      language,
      "The repository must be synchronized before this command can continue.",
      "继续此命令前必须先同步 repository。",
    ),
  };
  return summaries[observation.state] ?? localize(
    language,
    `Command ${command} is blocked.`,
    `命令 ${command} 当前受阻。`,
  );
}

/** @pure */
function validationResponse(intention, observation, language) {
  const valid = observation.state === "project-ready";
  return {
    kind: "validation-result",
    language,
    summary: valid
      ? localize(
        language,
        "The requested Silvermoon snapshot is valid.",
        "请求的 Silvermoon snapshot 验证通过。",
      )
      : blockedSummary(intention.command, observation, language),
    validation: {
      target: clone(intention.args.target),
      valid,
      ...(observation.eventHistory === undefined ? {} : { eventHistory: clone(observation.eventHistory) }),
      ...(observation.version === undefined
        ? {}
        : { version: clone(observation.version) }),
    },
    problems: clone(observation.problems ?? []),
  };
}

/** @pure */
function dialogueResponse(intention, internalObservation, language) {
  const observation = internalObservation.observation;
  const context = internalObservation.responseContext ?? {};
  const base = {
    language,
    details: observationDetails(observation),
  };
  const nextSteps = normalizeNextSteps(context.nextSteps);

  if (intention.command === "event" && observation.state === "event-result") {
    return {
      ...base, kind: "event-result",
      summary: localize(language, `Event result: ${observation.receipt.outcome}. Local writes are not primary integration.`,
        `事件结果：${observation.receipt.outcome}。本地写入不代表已集成 primary。`),
      receipt: clone(observation.receipt), nextSteps,
    };
  }
  if (BLOCKED_STATES.has(observation.state)) {
    return {
      ...base,
      kind: "blocked",
      summary: blockedSummary(intention.command, observation, language),
      problems: clone(observation.problems ?? []),
      nextSteps,
      ...(observation.selectedIdea === undefined
        ? {}
        : { idea: clone(observation.selectedIdea) }),
    };
  }

  if (intention.command === "create-idea" && observation.state === "idea-created") {
    return {
      ...base,
      kind: "idea-created",
      summary: localize(
        language,
        `Created idea ${observation.createdIdea.id}.`,
        `已创建 idea ${observation.createdIdea.id}。`,
      ),
      createdIdea: clone(observation.createdIdea),
      nextSteps,
      ...(observation.guidance === undefined
        ? {}
        : { guidance: clone(observation.guidance) }),
    };
  }

  if (intention.command === "whats-next") {
    if (observation.state === "navigation-ready") {
      const choices = clone(observation.ideas?.activeIdeas ?? []);
      return {
        ...base,
        kind: "choice-required",
        summary: choices.length === 0
          ? localize(
            language,
            "Current state: navigation-ready. No active ideas are available.",
            "当前状态：navigation-ready。当前没有 active idea。",
          )
          : localize(
            language,
            `Current state: navigation-ready. ${choices.length} active idea(s) are available.`,
            `当前状态：navigation-ready。当前有 ${choices.length} 个 active idea。`,
          ),
        choices,
        nextSteps,
      };
    }
    if (observation.state === "idea-not-found") {
      return {
        ...base,
        kind: "choice-required",
        summary: localize(
          language,
          `Idea ${intention.args.idea} was not found.`,
          `未找到 idea ${intention.args.idea}。`,
        ),
        choices: clone(observation.candidates ?? []),
        problems: clone(observation.problems ?? []),
        nextSteps,
      };
    }
    if (observation.state === "idea-selected") {
      const idea = clone(observation.selectedIdea);
      return {
        ...base,
        kind: "next-steps",
        summary: localize(
          language,
          `Continue idea ${idea.alias ?? idea.id}; its state is ${idea.state}.`,
          `继续推进 idea ${idea.alias ?? idea.id}；当前状态为 ${idea.state}。`,
        ),
        idea,
        nextSteps,
        ...(observation.guidance === undefined
          ? {}
          : { guidance: clone(observation.guidance) }),
      };
    }
  }

  if (intention.command === "list-ideas" && observation.state === "ideas-listed") {
    return {
      ...base,
      kind: "idea-list",
      summary: localize(
        language,
        `Matched ${observation.summary.matched} idea(s) and returned ${observation.summary.returned}.`,
        `匹配 ${observation.summary.matched} 个 idea，返回 ${observation.summary.returned} 个。`,
      ),
      query: clone(intention.args),
      inventory: clone(observation.summary),
      items: clone(observation.ideas),
    };
  }

  throw new Error(
    `Cannot produce a response for ${intention.command}:${observation.state}`,
  );
}

/** @pure */
export function respond(intention, internalObservation) {
  if (!intention || !internalObservation?.observation) {
    throw new Error("Response requires an intention and a final observation");
  }
  const language = responseLanguage(intention, internalObservation.observation);
  if (intention.command === "check") {
    return validationResponse(
      intention,
      internalObservation.observation,
      language,
    );
  }
  return dialogueResponse(intention, internalObservation, language);
}
