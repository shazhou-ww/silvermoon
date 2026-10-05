import { isDeepStrictEqual } from "node:util";

import { loadConfigSnapshot } from "../project-config/index.js";
import { EVENT_RENAMES, checkEventChange, eventsFromStatus, parseIdeaEvents, renameLegacyEvents, replayIdeaEvents, serializeIdeaEvents } from "../event-codec/index.js";
import { isValidUlid, parseIdeaStatus } from "../idea-model/index.js";
import { inspectTreeLineage, readGitBlob, readGitBlobs, resolveCommit, runGit } from "../git/index.js";
import { CONFIG_PATH, IDEAS_ROOT, ideaPaths } from "../coordinates/index.js";
import { EventStream } from "../event-store/index.js";
import { isEventAuxiliary, snapshotEventPrefix } from "../event-store/index.js";
import { createGitSnapshotFileSystem } from "../snapshot/index.js";
import { projectEventSnapshot, ProjectedReductionError } from "../projection-cache/index.js";

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

async function snapshot(root, tree, overrides, commit, blobs) {
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
  const stateBlobs = blobs ?? new Map();
  const stateFile = loaded.config.version === 2 ? "events.jsonl" : "status.yaml";
  const stateObjects = entries
    .filter(({ name, object, type }) =>
      type === "blob"
      && (name.endsWith(`/${stateFile}`) || (loaded.config.version === 2 && /\/events\/[0-9]{16}\.jsonl$/.test(name)))
      && !overrides?.has(name)
      && !stateBlobs.has(object)
    )
    .map(({ object }) => object);
  for (const [object, contents] of readGitBlobs(root, stateObjects)) {
    stateBlobs.set(object, contents);
  }
  const state = {
    version: loaded.config.version,
    entries,
    ids,
    sourceProject,
    overrides,
    commit,
    blobs: stateBlobs,
  };
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
  const paths = ideaPaths(id);
  if (name === "events.jsonl") {
    if (state.overrides?.has(paths.eventsDirectory)) return state.overrides.get(paths.eventsDirectory);
    const folder = state.entries.find(({ name }) => name === paths.eventsDirectory);
    if (folder) {
      if (folder.type !== "tree" || folder.mode !== "040000") throw new Error("Irregular historical event folder.");
      if (state.entries.some(({ name }) => name === paths.legacyEventsPath)) {
        throw new Error(`${id}: dual event authority in snapshot`);
      }
      const children = state.entries.filter(({ name }) => name.startsWith(`${paths.eventsDirectory}/`));
      if (children.some(({ type, mode }) => type !== "blob" || !["100644", "100755"].includes(mode))) {
        throw new Error("Irregular historical event entry.");
      }
      const segments = children.filter(({ name }) => !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)));
      const entries = segments.map((entry) => {
        if (!["100644", "100755"].includes(entry.mode)) throw new Error("Irregular historical event segment.");
        const bytes = state.blobs?.get(entry.object) ?? readGitBlob(root, entry.object);
        return { name: entry.name.slice(paths.eventsDirectory.length + 1), bytes };
      });
      return EventStream.fromSegments(entries, { objectIdLength: folder.object.length }).bytes();
    }
  }
  const path = `${ideaPaths(id).ideaPath}/${name}`;
  if (state.overrides?.has(path)) return state.overrides.get(path);
  const entry = state.entries.find(({ name: entryName }) => entryName === path);
  if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
    throw new Error(`Historical state file missing or irregular: ${path}`);
  }
  if (!state.blobs) return readGitBlob(root, entry.object);
  if (!state.blobs.has(entry.object)) state.blobs.set(entry.object, readGitBlob(root, entry.object));
  return state.blobs.get(entry.object);
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
  const directory = ideaPaths(id).eventsDirectory;
  const wasSegmented = base.entries.some(({ name }) => name === directory);
  const isSegmented = candidate.entries.some(({ name }) => name === directory);
  if (wasSegmented && !isSegmented) throw new Error(`${id}: segmented events cannot return to a single-file log`);
  if (!wasSegmented && isSegmented) {
    if (!base.sourceProject || !candidate.sourceProject || !previous.equals(next)
      || base.ids.length !== candidate.ids.length) {
      throw new Error(`${id}: source-only segmentation must preserve the complete inventory and exact event bytes`);
    }
    const result = replayIdeaEvents(id, parseIdeaEvents(next, candidateOptions), candidateOptions);
    if (!result.ok) throw new Error(`${id}: cannot segment an invalid event stream`);
    return { id, mode: "migration-segmented", candidate: result };
  }
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
  if (base.version === 2 && base.ids.some((id) =>
    !base.entries.some(({ name }) => name === ideaPaths(id).eventsDirectory))
    && candidate.ids.some((id) =>
      candidate.entries.some(({ name }) => name === ideaPaths(id).eventsDirectory))) {
    if (candidate.ids.length !== base.ids.length || candidate.ids.some((id) =>
      !candidate.entries.some(({ name }) => name === ideaPaths(id).eventsDirectory))) {
      throw new Error("Segmentation boundary must convert every existing idea without changing inventory.");
    }
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

export async function inspectProjectedEventHistory({ root, tree, primary }) {
  const loaded = await loadConfigSnapshot({ gitRoot: root, tree: primary });
  if (!loaded.config) throw new Error(`Invalid primary configuration: ${loaded.diagnostics.map((item) => item.message).join("; ")}`);
  if (loaded.config.version !== 2) return { supported: false, reason: "version-transition" };
  const baseline = createGitSnapshotFileSystem({ gitRoot: root, tree: primary });
  const candidate = createGitSnapshotFileSystem({ gitRoot: root, tree });
  const inventory = (filesystem) => filesystem.snapshotEntries(IDEAS_ROOT)
    .filter(({ type }) => type === "tree").map(({ name }) => name.slice(IDEAS_ROOT.length + 1));
  const previousIds = inventory(baseline);
  const ids = inventory(candidate);
  if ([...previousIds, ...ids].some((id) => !isValidUlid(id))) throw new Error("Historical idea identity is invalid.");
  if (previousIds.some((id) => !ids.includes(id))) throw new Error("Removing an integrated idea is not an event repair.");
  if (previousIds.some((id) => baseline.snapshotEntry(ideaPaths(id).eventsDirectory)?.type !== "tree")
    || ids.some((id) => candidate.snapshotEntry(ideaPaths(id).eventsDirectory)?.type !== "tree")) {
    return { supported: false, reason: "storage-transition" };
  }
  const options = { objectIdLength: primary.length };
  const results = [];
  const summarize = (projected) => ({
    length: projected.length, digest: projected.digest, sequence: projected.state.sequence,
  });
  for (const id of ids) {
    const paths = ideaPaths(id);
    const next = await projectEventSnapshot(root, id, paths, options, candidate);
    if (!previousIds.includes(id)) {
      results.push({ id, mode: "initialization", candidate: summarize(next) });
      continue;
    }
    let previous;
    try { previous = await projectEventSnapshot(root, id, paths, options, baseline); }
    catch (cause) {
      if (!(cause instanceof ProjectedReductionError)) throw cause;
      return { supported: false, reason: "primary-reduction-failed", id, reduction: cause.result };
    }
    if (await snapshotEventPrefix(root, paths, options, candidate, previous.length) !== previous.digest) {
      throw new Error(`${id}: not-append-only (append)`);
    }
    results.push({ id, mode: "append", base: summarize(previous), candidate: summarize(next) });
  }
  return {
    supported: true, valid: true, detail: "summary", target: "candidate",
    baseline: { commit: primary, source: "fetched-primary", ref: null }, results,
  };
}

async function inspectBoundHistory({
  root, tree, commit, overrides, baseline,
}) {
  const blobs = new Map();
  const primaryCommit = resolveCommit(root, baseline.commit);
  const target = await snapshot(root, tree, overrides, commit, blobs);
  const options = { objectIdLength: primaryCommit.length };
  const results = [];
  const targetCommit = commit === undefined ? null : resolveCommit(root, commit);
  const parent = targetCommit ? firstParent(root, targetCommit) : null;
  const baseCommit = targetCommit ? parent : primaryCommit;
  const base = baseCommit
    ? await snapshot(root, baseCommit, undefined, baseCommit, blobs)
    : { version: null, ids: [], entries: [] };
  noDeletion(base, target);
  if (target.version === 2) {
    for (const id of target.ids) results.push(transition(root, base, target, id, options));
  }
  return {
    valid: true, baseline, target: targetCommit ? "commit" : "candidate",
    ...(targetCommit ? { parent: baseCommit } : {}),
    results,
  };
}
