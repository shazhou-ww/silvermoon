import { isDeepStrictEqual } from "node:util";

import { loadConfigSnapshot } from "./config.js";
import { EVENT_RENAMES, checkEventChange, eventsFromStatus, parseIdeaEvents, renameLegacyEvents, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { isValidUlid, parseIdeaStatus } from "./ideas.js";
import { inspectTreeLineage, readGitBlob, resolveCommit, runGit } from "./git.js";
import { CONFIG_PATH, IDEAS_ROOT, ideaPaths } from "./layout.js";

export const SOURCE_REPOSITORY = "https://github.com/shazhou-ww/silvermoon.git";

function git(root, args) {
  const result = runGit(root, args);
  if (!result.ok) throw new Error(`Event history unavailable: ${result.stderr}`);
  return result.stdout;
}

export function localPrimary(root, config) {
  const refs = [];
  for (const remote of git(root, ["remote"]).split("\n").filter(Boolean)) {
    const url = git(root, ["config", "--get", `remote.${remote}.url`]);
    if (url !== config.primaryRepository) continue;
    const ref = `refs/remotes/${remote}/${config.primaryBranch}`;
    const result = runGit(root, ["rev-parse", "--verify", `${ref}^{commit}`]);
    if (result.ok) refs.push({ ref, commit: result.stdout });
  }
  if (!refs.length) {
    throw new Error("Primary tracking ref unavailable; fetch the configured primary into its named remote.");
  }
  if (new Set(refs.map(({ commit }) => commit)).size !== 1) {
    throw new Error("Primary tracking refs disagree; refresh them before checking.");
  }
  return { ...refs[0], source: "local-tracking-ref-not-fetched" };
}

async function snapshot(root, tree, overrides, commit) {
  const configEntry = inspectTreeLineage(root, tree, CONFIG_PATH)
    .find(({ name }) => name === CONFIG_PATH);
  const entries = inspectTreeLineage(root, tree, IDEAS_ROOT);
  if (!configEntry) {
    if (entries.length) throw new Error("Historical ideas exist without project configuration.");
    return { version: null, entries, ids: [] };
  }
  const loaded = await loadConfigSnapshot({ gitRoot: root, tree });
  if (!loaded.config) throw new Error(`Invalid historical configuration: ${loaded.diagnostics.map((d) => d.message).join("; ")}`);
  const ids = entries
    .filter(({ type, name }) => type === "tree" && name.split("/").length === 3)
    .map(({ name }) => name.split("/")[2]);
  if (ids.some((id) => !isValidUlid(id))) throw new Error("Historical idea identity is invalid.");
  const sourceProject = loaded.config.primaryRepository === SOURCE_REPOSITORY;
  const state = { version: loaded.config.version, entries, ids, sourceProject, overrides, commit };
  if (state.version !== 2) return { ...state, format: null };
  const formats = new Set();
  for (const id of ids) {
    const bytes = source(root, state, id, "events.jsonl");
    if (!bytes.length) continue;
    let first;
    try {
      first = JSON.parse(bytes.toString("utf8").split("\n", 1)[0]);
    } catch (cause) {
      throw new Error(`${id}: cannot identify historical event format: ${cause.message}`, { cause });
    }
    const format = Object.hasOwn(EVENT_RENAMES, first?.type) ? "legacy" : "final";
    if (format === "legacy" && !sourceProject) {
      throw new Error(`${id}: legacy dotted event history is only supported in the Silvermoon source repository`);
    }
    parseIdeaEvents(bytes, { legacy: format === "legacy", objectIdLength: tree.length });
    formats.add(format);
  }
  if (formats.size > 1) throw new Error("Mixed legacy and final idea logs in one snapshot; migrate every idea together.");
  return { ...state, format: formats.values().next().value ?? null };
}

export async function detectEventFormat({ root, tree, overrides }) {
  const state = await snapshot(root, tree, overrides);
  if (state.format) return state.format;
  if (!state.sourceProject || state.version !== 2) return "final";
  let commit = resolveCommit(root, "HEAD");
  while (commit) {
    const previous = await snapshot(root, commit);
    if (previous.version !== 2) break;
    if (previous.format) return previous.format;
    commit = firstParent(root, commit);
  }
  return "legacy";
}

function source(root, state, id, name) {
  const path = `${ideaPaths(id).ideaPath}/${name}`;
  if (state.overrides?.has(path)) return state.overrides.get(path);
  const entry = state.entries.find(({ name: entryName }) => entryName === path);
  if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
    throw new Error(`Historical state file missing or irregular: ${path}`);
  }
  return readGitBlob(root, entry.object);
}

function transition(root, base, candidate, id, options) {
  const next = source(root, candidate, id, "events.jsonl");
  const candidateOptions = { ...options, legacy: candidate.format === "legacy" };
  if (!base.ids.includes(id)) {
    const result = replayIdeaEvents(id, parseIdeaEvents(next, candidateOptions), candidateOptions);
    if (!result.ok) throw new Error(`${id}: candidate ${result.code} at ${result.sequence}`);
    return { id, mode: "initialization", candidate: result };
  }
  if (base.version === 1) {
    const legacy = parseIdeaStatus(source(root, base, id, "status.yaml").toString("utf8"), options);
    const result = replayIdeaEvents(id, parseIdeaEvents(next, candidateOptions), candidateOptions);
    const { version: _version, ...facts } = legacy;
    if (legacy.id !== id || !result.ok || !isDeepStrictEqual(facts, result.state.status)
      || (!candidateOptions.legacy
        && !isDeepStrictEqual(result.state.interaction, { messages: [], lastSignal: null }))
      || !next.equals(Buffer.from(serializeIdeaEvents(eventsFromStatus(legacy, candidateOptions), candidateOptions)))) {
      throw new Error(`${id}: migration must preserve every primary v1 fact exactly`);
    }
    return { id, mode: "migration", candidate: result };
  }
  const previous = source(root, base, id, "events.jsonl");
  if (base.format === "legacy" && candidate.format === "final") {
    if (base.ids.length !== candidate.ids.length) {
      throw new Error("Legacy event migration must convert every existing idea without changing inventory.");
    }
    const legacyOptions = { ...options, legacy: true };
    const oldEvents = parseIdeaEvents(previous, legacyOptions);
    const old = replayIdeaEvents(id, oldEvents, legacyOptions);
    if (!old.ok) throw new Error(`${id}: cannot migrate invalid legacy event ${old.sequence}: ${old.code}`);
    const newEvents = parseIdeaEvents(next, candidateOptions);
    if (!isDeepStrictEqual(newEvents, renameLegacyEvents(oldEvents))) {
      throw new Error(`${id}: internal migration must preserve every legacy record, sequence and payload with only the exact type rename`);
    }
    const result = replayIdeaEvents(id, newEvents, candidateOptions);
    if (!result.ok || !isDeepStrictEqual(
      { status: result.state.status, sequence: result.state.sequence },
      old.state,
    ) || !isDeepStrictEqual(result.state.interaction, { messages: [], lastSignal: null })) {
      throw new Error(`${id}: internal migration changes historical facts or contains an invalid abandoned window`);
    }
    return { id, mode: "migration-final", candidate: result };
  }
  if (base.format === "final" && candidate.format === "legacy") {
    throw new Error(`${id}: final event history cannot return to legacy dotted events`);
  }
  const result = checkEventChange(id, previous, next,
    { ...options, legacy: (candidate.format ?? base.format) === "legacy" });
  if (base.sourceProject && base.format === "final" && result.mode === "repair"
    && hasLegacyAncestor(root, base.commit)) {
    throw new Error(`${id}: final event history must remain append-only after the migration boundary`);
  }
  if (!result.ok) throw Object.assign(new Error(`${id}: ${result.code} (${result.mode})`), { eventCheck: { id, ...result } });
  return { id, ...result };
}

function noDeletion(base, candidate) {
  for (const id of base.ids) {
    if (!candidate.ids.includes(id)) throw new Error(`${id}: removing an integrated idea is not an event repair`);
  }
  if (base.version >= 2 && candidate.version < base.version) {
    throw new Error("An event project cannot be downgraded to an earlier version.");
  }
  if (base.format === "legacy" && candidate.format === "final"
    && (base.ids.length !== candidate.ids.length || base.ids.some((id) => !candidate.ids.includes(id)))) {
    throw new Error("Legacy event migration must convert every existing idea without changing inventory.");
  }
}

function firstParent(root, commit) {
  // Read the object itself: rev-list alone hides shallow parents.
  const body = git(root, ["cat-file", "-p", commit]);
  return /^parent ([0-9a-f]+)$/m.exec(body.split("\n\n")[0])?.[1] ?? null;
}

function hasLegacyAncestor(root, commit) {
  while (commit) {
    const state = snapshotFormat(root, commit);
    if (state === "legacy") return true;
    if (state !== "final") return false;
    commit = firstParent(root, commit);
  }
  return false;
}

function snapshotFormat(root, commit) {
  const entries = inspectTreeLineage(root, commit, IDEAS_ROOT);
  for (const { name, type, object } of entries) {
    if (type !== "blob" || !name.endsWith("/events.jsonl")) continue;
    const bytes = readGitBlob(root, object);
    if (!bytes.length) continue;
    const first = JSON.parse(bytes.toString("utf8").split("\n", 1)[0]);
    return Object.hasOwn(EVENT_RENAMES, first.type) ? "legacy" : "final";
  }
  return inspectTreeLineage(root, commit, CONFIG_PATH).some(({ name }) => name === CONFIG_PATH)
    ? "final" : null;
}

export async function inspectEventHistory(options) {
  const baseline = options.primary
    ? { commit: options.primary, source: "fetched-primary", ref: null }
    : localPrimary(options.root, options.config);
  try {
    return await inspectBoundHistory({ ...options, baseline });
  } catch (cause) {
    cause.eventBaseline = baseline;
    throw cause;
  }
}

async function inspectBoundHistory({
  root, tree, commit, overrides, baseline, auditCandidate = false,
}) {
  const primaryCommit = resolveCommit(root, baseline.commit);
  const chain = git(root, ["rev-list", "--first-parent", primaryCommit]).split("\n");
  const integrated = commit !== undefined && chain.includes(commit);
  const target = await snapshot(root, tree, overrides);
  const options = { objectIdLength: primaryCommit.length };
  const results = [];
  let auditCommit;
  if (integrated) {
    auditCommit = commit;
  } else {
    const base = await snapshot(root, primaryCommit, undefined, primaryCommit);
    noDeletion(base, target);
    if (target.version === 2) {
      for (const id of target.ids) results.push(transition(root, base, target, id, options));
    }
    // A verified repair is the audit boundary for this idea, not for its peers.
    auditCommit = primaryCommit;
  }
  const settled = new Set(results.filter(({ mode }) => mode === "repair").map(({ id }) => id));
  const history = [];
  while (auditCommit) {
    const current = await snapshot(root, auditCommit, undefined, auditCommit);
    if (current.version !== 2) break;
    const parent = firstParent(root, auditCommit);
    const previous = parent
      ? await snapshot(root, resolveCommit(root, parent), undefined, parent)
      : { version: null, ids: [], entries: [] };
    noDeletion(previous, current);
    for (const id of current.ids) {
      if (settled.has(id)) continue;
      const result = transition(root, previous, current, id, options);
      history.push({ commit: auditCommit, ...result });
      if (result.mode !== "append" && result.mode !== "migration-final") settled.add(id);
    }
    auditCommit = parent;
    if (current.ids.every((id) => settled.has(id))) break;
  }
  if (auditCandidate && !integrated) {
    const candidateCommit = commit ?? resolveCommit(root, "HEAD");
    const localChain = git(root, ["rev-list", "--first-parent", candidateCommit]).split("\n");
    const primaryIndex = localChain.indexOf(primaryCommit);
    if (primaryIndex > 0) {
      // These commits would become primary history on a fast-forward, so each
      // transition must be legal. Other merge parents remain local candidate history.
      const pending = localChain.slice(0, primaryIndex).reverse();
      let previous = await snapshot(root, primaryCommit, undefined, primaryCommit);
      for (const pendingCommit of pending) {
        const current = await snapshot(root, pendingCommit, undefined, pendingCommit);
        noDeletion(previous, current);
        if (current.version === 2) {
          for (const id of current.ids) {
            try { transition(root, previous, current, id, options); }
            catch (cause) {
              throw new Error(`Cannot fast-forward candidate ${pendingCommit}: ${cause.message}. Preserve both histories and use a merge with current primary as first parent.`, { cause });
            }
          }
        }
        previous = current;
      }
    }
  }
  return { valid: true, baseline, target: integrated ? "integrated-first-parent" : "candidate", results, history };
}
