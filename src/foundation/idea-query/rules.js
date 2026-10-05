import { fromMarkdown } from "mdast-util-from-markdown";

import { isValidUlid } from "../idea-model/index.js";

const SORTS = new Set(["newest", "oldest"]);
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/;
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** @pure */
function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

/** @pure */
function normalizeStates(states, all, {
  ideaStates: IDEA_STATES,
  activeStates: ACTIVE_IDEA_STATES,
  queryStates: QUERY_STATES,
}) {
  if (all !== undefined && typeof all !== "boolean") {
    throw usageError("all must be a boolean");
  }
  if (states !== undefined && all === true) {
    throw usageError("state and all are mutually exclusive");
  }
  if (states === undefined) {
    return all === true ? [...IDEA_STATES] : [...ACTIVE_IDEA_STATES];
  }
  const requested = Array.isArray(states) ? states : [states];
  if (requested.length === 0) {
    throw usageError("state must not be empty");
  }
  const selected = new Set();
  for (const state of requested) {
    if (typeof state !== "string" || !QUERY_STATES.has(state)) {
      throw usageError(
        `state must be one of active, ${IDEA_STATES.join(", ")}; received ${JSON.stringify(state)}`,
      );
    }
    for (const expanded of state === "active" ? ACTIVE_IDEA_STATES : [state]) {
      selected.add(expanded);
    }
  }
  return IDEA_STATES.filter((state) => selected.has(state));
}

/** @pure */
function normalizeQueryText(query) {
  if (query === undefined || query === null) return null;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw usageError("query must be a non-empty string");
  }
  return query.trim();
}

/** @pure */
function normalizeTimestamp(value, name) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw usageError(`${name} must be an RFC 3339 timestamp`);
  }
  const match = RFC3339.exec(value);
  if (!match) throw usageError(`${name} must be an RFC 3339 timestamp with a timezone`);
  const [, year, month, day, hour, minute, second, , zone, offsetHour, offsetMinute] =
    match;
  const numeric = [year, month, day, hour, minute, second].map(Number);
  if (
    numeric[1] < 1
    || numeric[1] > 12
    || numeric[2] < 1
    || numeric[2] > 31
    || numeric[3] > 23
    || numeric[4] > 59
    || numeric[5] > 59
    || (
      zone !== "Z"
      && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)
    )
  ) {
    throw usageError(`${name} must be a valid RFC 3339 timestamp`);
  }
  const calendar = new Date(0);
  calendar.setUTCFullYear(numeric[0], numeric[1] - 1, numeric[2]);
  calendar.setUTCHours(0, 0, 0, 0);
  if (
    calendar.getUTCFullYear() !== numeric[0]
    || calendar.getUTCMonth() !== numeric[1] - 1
    || calendar.getUTCDate() !== numeric[2]
  ) {
    throw usageError(`${name} must be a valid RFC 3339 timestamp`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw usageError(`${name} must be a valid RFC 3339 timestamp`);
  }
  return new Date(timestamp).toISOString();
}

/** @pure */
function normalizeSort(sort) {
  const value = sort ?? "newest";
  if (typeof value !== "string" || !SORTS.has(value)) {
    throw usageError("sort must be newest or oldest");
  }
  return value;
}

/** @pure */
function normalizeLimit(limit) {
  if (limit === undefined || limit === null) return null;
  const value = typeof limit === "number"
    ? limit
    : typeof limit === "string" && /^[1-9]\d*$/.test(limit)
      ? Number(limit)
      : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw usageError("limit must be a positive integer");
  }
  return value;
}

/** @pure */
export function normalizeIdeaQueryCore({
  all,
  createdBefore,
  createdSince,
  limit,
  query,
  sort,
  states,
} = {}, facts) {
  const normalized = {
    states: normalizeStates(states, all, facts),
    query: normalizeQueryText(query),
    createdSince: normalizeTimestamp(createdSince, "createdSince"),
    createdBefore: normalizeTimestamp(createdBefore, "createdBefore"),
    sort: normalizeSort(sort),
    limit: normalizeLimit(limit),
  };
  if (
    normalized.createdSince !== null
    && normalized.createdBefore !== null
    && Date.parse(normalized.createdSince) >= Date.parse(normalized.createdBefore)
  ) {
    throw usageError("createdSince must be earlier than createdBefore");
  }
  return normalized;
}

/** @pure */
export function ideaCreatedAt(id) {
  if (!isValidUlid(id)) throw new Error(`Cannot decode invalid idea ULID: ${id}`);
  let timestamp = 0;
  for (const character of id.slice(0, 10)) {
    timestamp = timestamp * 32 + CROCKFORD_BASE32.indexOf(character);
  }
  return new Date(timestamp).toISOString();
}

/** @pure */
function markdownText(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(markdownText).join("");
}

/** @pure */
export function extractIdeaTitle(source) {
  if (typeof source !== "string") {
    throw new TypeError("Idea document source must be a string");
  }
  const heading = fromMarkdown(source).children.find(
    (node) => node.type === "heading" && node.depth === 1,
  );
  if (!heading) return undefined;
  const title = markdownText(heading).replaceAll(/\s+/g, " ").trim();
  return title.length === 0 ? undefined : title;
}

/** @pure */
export function ideaInventoryItem(idea, title) {
  const item = {
    id: idea.id,
    state: idea.state,
    createdAt: ideaCreatedAt(idea.id),
  };
  if (idea.alias !== undefined) item.alias = idea.alias;
  if (title !== undefined) item.title = title;
  return item;
}

/** @pure */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @pure */
export function queryIdeaInventoryCore(items, input, facts) {
  const query = normalizeIdeaQueryCore(input, facts);
  const states = new Set(query.states);
  const needle = query.query?.toLowerCase();
  const createdSince = query.createdSince === null
    ? null
    : Date.parse(query.createdSince);
  const createdBefore = query.createdBefore === null
    ? null
    : Date.parse(query.createdBefore);
  const filtered = items.filter((idea) => {
    if (!states.has(idea.state)) return false;
    if (
      needle !== undefined
      && ![idea.id, idea.alias, idea.title]
        .filter((value) => value !== undefined)
        .some((value) => value.toLowerCase().includes(needle))
    ) {
      return false;
    }
    const createdAt = Date.parse(idea.createdAt);
    if (createdSince !== null && createdAt < createdSince) return false;
    return createdBefore === null || createdAt < createdBefore;
  });
  const direction = query.sort === "newest" ? -1 : 1;
  filtered.sort((left, right) => direction * compareText(left.id, right.id));
  const counts = Object.fromEntries(facts.ideaStates.map((state) => [state, 0]));
  for (const idea of filtered) counts[idea.state] += 1;
  const ideas = query.limit === null
    ? filtered
    : filtered.slice(0, query.limit);
  return {
    query,
    summary: {
      matched: filtered.length,
      returned: ideas.length,
      truncated: ideas.length < filtered.length,
      counts,
    },
    ideas,
  };
}
