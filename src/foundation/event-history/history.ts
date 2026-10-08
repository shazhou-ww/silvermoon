import { isDeepStrictEqual } from "node:util";

import { loadConfigSnapshot } from "../project-config/index.ts";
import {
  EVENT_RENAMES,
  checkEventChange,
  eventsFromStatus,
  parseIdeaEvents,
  renameLegacyEvents,
  replayIdeaEvents,
  serializeIdeaEvents,
} from "../event-codec/index.ts";
import { isValidUlid, parseIdeaStatus } from "../idea-model/index.ts";
import {
  inspectTreeLineage,
  readGitBlob,
  readGitBlobs,
  resolveCommit,
  runGit,
} from "../git/index.ts";
import { CONFIG_PATH, IDEAS_ROOT, ideaPaths } from "../coordinates/index.ts";
import { snapshotEventPrefix, validateEventRecordSizes } from "../event-store/index.ts";
import { createGitSnapshotFileSystem } from "../snapshot/index.ts";
import { projectEventSnapshot, ProjectedReductionError } from "../projection-cache/index.ts";

export const SOURCE_REPOSITORY = "https://github.com/shazhou-ww/silvermoon.git";

type EventFormat = "legacy" | "final";

interface ProjectConfig {
  version: 1 | 2;
  primaryRepository: string;
  primaryBranch: string;
}

interface TreeEntry {
  mode: string;
  type: string;
  object: string;
  size: number | null;
  name: string;
}

interface EventOptions {
  objectIdLength: number;
  legacy?: boolean;
}

interface SnapshotState {
  version: 1 | 2 | null;
  entries: TreeEntry[];
  ids: string[];
  sourceProject: boolean;
  overrides: ReadonlyMap<string, Buffer> | undefined;
  commit: string | undefined;
  blobs: Map<string, Buffer>;
  format: EventFormat | null;
}

export interface HistoryBaseline {
  commit: string;
  source: string;
  ref: string | null;
}

interface InspectHistoryOptions {
  root: string;
  tree: string;
  config: ProjectConfig;
  commit?: string;
  primary?: string;
  overrides?: ReadonlyMap<string, Buffer>;
}

interface BoundHistoryOptions extends InspectHistoryOptions {
  baseline: HistoryBaseline;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireBuffer(value: unknown, label: string): Buffer {
  if (!Buffer.isBuffer(value)) throw new TypeError(`${label} must provide raw bytes.`);
  return value;
}

function requireTreeEntries(value: unknown): TreeEntry[] {
  if (!Array.isArray(value)) throw new TypeError("Git tree inspection must return entries.");
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object"
      || !("mode" in entry) || typeof entry.mode !== "string"
      || !("type" in entry) || typeof entry.type !== "string"
      || !("object" in entry) || typeof entry.object !== "string"
      || !("name" in entry) || typeof entry.name !== "string"
      || !("size" in entry)
      || (entry.size !== null && typeof entry.size !== "number")) {
      throw new TypeError("Git tree inspection returned an invalid entry.");
    }
    return {
      mode: entry.mode,
      type: entry.type,
      object: entry.object,
      size: entry.size,
      name: entry.name,
    };
  });
}

function treeEntries(root: string, tree: string, path: string): TreeEntry[] {
  return requireTreeEntries(inspectTreeLineage(root, tree, path));
}

function parsedEventType(bytes: Buffer, id: string): string {
  let first: unknown;
  try {
    first = JSON.parse(bytes.toString("utf8").split("\n", 1)[0] ?? "");
  } catch (cause) {
    throw new Error(
      `${id}: cannot identify historical event format: ${errorMessage(cause)}`,
      { cause },
    );
  }
  if (first === null || typeof first !== "object"
    || !("type" in first) || typeof first.type !== "string") {
    throw new Error(`${id}: cannot identify historical event format: first event type is invalid`);
  }
  return first.type;
}

function git(root: string, args: string[]) {
  const result = runGit(root, args);
  if (!result.ok) throw new Error(`Event history unavailable: ${result.stderr}`);
  return result.stdout;
}

export function localPrimary(root: string, config: ProjectConfig): HistoryBaseline {
  const refs: { ref: string; commit: string }[] = [];
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
  const first = refs[0];
  if (!first) throw new Error("Primary tracking ref unavailable.");
  return { ...first, source: "local-tracking-ref-not-fetched" };
}

async function snapshot(
  root: string,
  tree: string,
  overrides?: ReadonlyMap<string, Buffer>,
  commit?: string,
  blobs?: Map<string, Buffer>,
): Promise<SnapshotState> {
  const configEntry = treeEntries(root, tree, CONFIG_PATH)
    .find(({ name }) => name === CONFIG_PATH);
  const entries = treeEntries(root, tree, IDEAS_ROOT);
  const stateBlobs = blobs ?? new Map<string, Buffer>();
  if (!configEntry) {
    if (entries.length) throw new Error("Historical ideas exist without project configuration.");
    return {
      version: null,
      entries,
      ids: [],
      sourceProject: false,
      overrides,
      commit,
      blobs: stateBlobs,
      format: null,
    };
  }
  const loaded = await loadConfigSnapshot({ gitRoot: root, tree });
  if (!loaded.config) {
    throw new Error(
      `Invalid historical configuration: ${loaded.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`,
    );
  }
  if (loaded.config.version !== 1 && loaded.config.version !== 2) {
    throw new Error("Invalid historical configuration version.");
  }
  const config = loaded.config;
  const ids = entries
    .filter(({ type, name }) => type === "tree" && name.split("/").length === 3)
    .map(({ name }) => name.split("/")[2])
    .filter((id): id is string => id !== undefined);
  if (ids.some((id) => !isValidUlid(id))) {
    throw new Error("Historical idea identity is invalid.");
  }
  const sourceProject = config.primaryRepository === SOURCE_REPOSITORY;
  const stateFile = config.version === 2 ? "events.jsonl" : "status.yaml";
  const stateObjects = entries
    .filter(({ name, object, type }) =>
      type === "blob"
      && name.endsWith(`/${stateFile}`)
      && !overrides?.has(name)
      && !stateBlobs.has(object))
    .map(({ object }) => object);
  for (const [object, contents] of readGitBlobs(root, stateObjects)) {
    if (typeof object !== "string") throw new TypeError("Git batch returned an invalid object ID.");
    stateBlobs.set(object, requireBuffer(contents, `Git object ${object}`));
  }
  const state: SnapshotState = {
    version: config.version,
    entries,
    ids,
    sourceProject,
    overrides,
    commit,
    blobs: stateBlobs,
    format: null,
  };
  if (state.version !== 2) return state;
  const formats = new Set<EventFormat>();
  for (const id of ids) {
    const bytes = source(root, state, id, "events.jsonl");
    if (!bytes.length) continue;
    const format: EventFormat = Object.hasOwn(EVENT_RENAMES, parsedEventType(bytes, id))
      ? "legacy"
      : "final";
    if (format === "legacy" && !sourceProject) {
      throw new Error(
        `${id}: legacy dotted event history is only supported in the Silvermoon source repository`,
      );
    }
    parseIdeaEvents(bytes, { legacy: format === "legacy", objectIdLength: tree.length });
    formats.add(format);
  }
  if (formats.size > 1) {
    throw new Error("Mixed legacy and final idea logs in one snapshot; migrate every idea together.");
  }
  state.format = formats.values().next().value ?? null;
  return state;
}

export async function detectEventFormat({
  root,
  tree,
  overrides,
}: Pick<InspectHistoryOptions, "root" | "tree" | "overrides">) {
  const state = await snapshot(root, tree, overrides);
  if (state.format) return state.format;
  if (!state.sourceProject || state.version !== 2) return "final";
  let commit: string | null = resolveCommit(root, "HEAD");
  while (commit) {
    const previous = await snapshot(root, commit);
    if (previous.version !== 2) break;
    if (previous.format) return previous.format;
    commit = firstParent(root, commit);
  }
  return "legacy";
}

function source(root: string, state: SnapshotState, id: string, name: string): Buffer {
  const paths = ideaPaths(id);
  const path = `${paths.ideaPath}/${name}`;
  const override = state.overrides?.get(path);
  if (override !== undefined) {
    const bytes = requireBuffer(override, `Historical override ${path}`);
    if (name === "events.jsonl") validateEventRecordSizes(bytes);
    return bytes;
  }
  const entry = state.entries.find(({ name: entryName }) => entryName === path);
  if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
    throw new Error(`Historical state file missing or irregular: ${path}`);
  }
  const cached = state.blobs.get(entry.object);
  if (cached !== undefined) {
    if (name === "events.jsonl") validateEventRecordSizes(cached);
    return cached;
  }
  const bytes = requireBuffer(readGitBlob(root, entry.object), `Git object ${entry.object}`);
  state.blobs.set(entry.object, bytes);
  if (name === "events.jsonl") validateEventRecordSizes(bytes);
  return bytes;
}

function reductionFailure(result: object): { code: unknown; sequence: unknown } {
  return {
    code: "code" in result ? result.code : "missing-code",
    sequence: "sequence" in result ? result.sequence : "unknown",
  };
}

function transition(
  root: string,
  base: SnapshotState,
  candidate: SnapshotState,
  id: string,
  options: EventOptions,
) {
  const next = source(root, candidate, id, "events.jsonl");
  const candidateOptions = { ...options, legacy: candidate.format === "legacy" };
  if (!base.ids.includes(id)) {
    const result = replayIdeaEvents(id, parseIdeaEvents(next, candidateOptions), candidateOptions);
    if (!result.ok || !("state" in result)) {
      const failure = reductionFailure(result);
      throw new Error(`${id}: candidate ${String(failure.code)} at ${String(failure.sequence)}`);
    }
    return { id, mode: "initialization", candidate: result };
  }
  if (base.version === 1) {
    const legacy = parseIdeaStatus(
      source(root, base, id, "status.yaml").toString("utf8"),
      options,
    );
    const result = replayIdeaEvents(id, parseIdeaEvents(next, candidateOptions), candidateOptions);
    const { version: _version, ...facts } = legacy;
    const migrationEvents: unknown = Reflect.apply(
      eventsFromStatus,
      undefined,
      [legacy, candidateOptions],
    );
    if (!Array.isArray(migrationEvents)) {
      throw new TypeError("Status migration did not produce an event list.");
    }
    if (legacy.id !== id || !result.ok || !("state" in result)
      || !isDeepStrictEqual(facts, result.state.status)
      || (!candidateOptions.legacy
        && !isDeepStrictEqual(result.state.interaction, { messages: [], lastSignal: null }))
      || !next.equals(Buffer.from(
        serializeIdeaEvents(migrationEvents, candidateOptions),
      ))) {
      throw new Error(`${id}: migration must preserve every primary v1 fact exactly`);
    }
    return { id, mode: "migration", candidate: result };
  }
  const previous = source(root, base, id, "events.jsonl");
  if (base.format === "legacy" && candidate.format === "final") {
    if (base.ids.length !== candidate.ids.length) {
      throw new Error(
        "Legacy event migration must convert every existing idea without changing inventory.",
      );
    }
    const legacyOptions = { ...options, legacy: true };
    const oldEvents = parseIdeaEvents(previous, legacyOptions);
    const old = replayIdeaEvents(id, oldEvents, legacyOptions);
    if (!old.ok || !("state" in old)) {
      const failure = reductionFailure(old);
      throw new Error(
        `${id}: cannot migrate invalid legacy event ${String(failure.sequence)}: ${String(failure.code)}`,
      );
    }
    const newEvents = parseIdeaEvents(next, candidateOptions);
    if (!isDeepStrictEqual(newEvents, renameLegacyEvents(oldEvents))) {
      throw new Error(
        `${id}: internal migration must preserve every legacy record, sequence and payload with only the exact type rename`,
      );
    }
    const result = replayIdeaEvents(id, newEvents, candidateOptions);
    if (!result.ok || !("state" in result) || !isDeepStrictEqual(
      { status: result.state.status, sequence: result.state.sequence },
      old.state,
    ) || !isDeepStrictEqual(
      result.state.interaction,
      { messages: [], lastSignal: null },
    )) {
      throw new Error(
        `${id}: internal migration changes historical facts or contains an invalid abandoned window`,
      );
    }
    return { id, mode: "migration-final", candidate: result };
  }
  if (base.format === "final" && candidate.format === "legacy") {
    throw new Error(`${id}: final event history cannot return to legacy dotted events`);
  }
  const checked: unknown = Reflect.apply(checkEventChange, undefined, [
    id,
    previous,
    next,
    { ...options, legacy: (candidate.format ?? base.format) === "legacy" },
  ]);
  if (checked === null || typeof checked !== "object"
    || !("ok" in checked) || typeof checked.ok !== "boolean"
    || !("mode" in checked) || typeof checked.mode !== "string") {
    throw new TypeError("Event change inspection returned an invalid result.");
  }
  if (base.sourceProject && base.format === "final" && checked.mode === "repair"
    && hasLegacyAncestor(root, base.commit ?? null)) {
    throw new Error(
      `${id}: final event history must remain append-only after the migration boundary`,
    );
  }
  if (!checked.ok) {
    const failure = reductionFailure(checked);
    throw Object.assign(
      new Error(`${id}: ${String(failure.code)} (${checked.mode})`),
      { eventCheck: { id, ...checked } },
    );
  }
  return { id, ...checked };
}

function noDeletion(base: SnapshotState, candidate: SnapshotState) {
  for (const id of base.ids) {
    if (!candidate.ids.includes(id)) {
      throw new Error(`${id}: removing an integrated idea is not an event repair`);
    }
  }
  if (base.version !== null && candidate.version !== null
    && base.version >= 2 && candidate.version < base.version) {
    throw new Error("An event project cannot be downgraded to an earlier version.");
  }
  if (base.format === "legacy" && candidate.format === "final"
    && (base.ids.length !== candidate.ids.length
      || base.ids.some((id) => !candidate.ids.includes(id)))) {
    throw new Error(
      "Legacy event migration must convert every existing idea without changing inventory.",
    );
  }
}

function firstParent(root: string, commit: string) {
  const body = git(root, ["cat-file", "-p", commit]);
  return /^parent ([0-9a-f]+)$/m.exec(body.split("\n\n")[0] ?? "")?.[1] ?? null;
}

function hasLegacyAncestor(root: string, initialCommit: string | null) {
  let commit = initialCommit;
  while (commit) {
    const state = snapshotFormat(root, commit);
    if (state === "legacy") return true;
    if (state !== "final") return false;
    commit = firstParent(root, commit);
  }
  return false;
}

function snapshotFormat(root: string, commit: string): EventFormat | null {
  const entries = treeEntries(root, commit, IDEAS_ROOT);
  for (const { name, type, object } of entries) {
    if (type !== "blob" || !name.endsWith("/events.jsonl")) continue;
    const bytes = requireBuffer(readGitBlob(root, object), `Git object ${object}`);
    if (!bytes.length) continue;
    return Object.hasOwn(EVENT_RENAMES, parsedEventType(bytes, name)) ? "legacy" : "final";
  }
  return treeEntries(root, commit, CONFIG_PATH).some(({ name }) => name === CONFIG_PATH)
    ? "final"
    : null;
}

export async function inspectEventHistory(options: InspectHistoryOptions) {
  const baseline = options.primary
    ? { commit: options.primary, source: "fetched-primary", ref: null }
    : localPrimary(options.root, options.config);
  try {
    return await inspectBoundHistory({ ...options, baseline });
  } catch (cause) {
    if (cause instanceof Error) throw Object.assign(cause, { eventBaseline: baseline });
    throw Object.assign(new Error(errorMessage(cause), { cause }), { eventBaseline: baseline });
  }
}

function snapshotInventory(
  filesystem: ReturnType<typeof createGitSnapshotFileSystem>,
): string[] {
  const entries = requireTreeEntries(filesystem.snapshotEntries(IDEAS_ROOT));
  return entries
    .filter(({ type }) => type === "tree")
    .map(({ name }) => name.slice(IDEAS_ROOT.length + 1));
}

type GitSnapshotFileSystem = ReturnType<typeof createGitSnapshotFileSystem>;
type SnapshotDirectoryEntry = Exclude<
  Awaited<ReturnType<GitSnapshotFileSystem["readdir"]>>[number],
  string
>;

function withPreciseReaddir(filesystem: GitSnapshotFileSystem) {
  async function readdir(path: string): Promise<string[]>;
  async function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<SnapshotDirectoryEntry[]>;
  async function readdir(
    path: string,
    options?: { withFileTypes: true },
  ): Promise<string[] | SnapshotDirectoryEntry[]> {
    if (options?.withFileTypes === true) {
      const entries = await filesystem.readdir(path, options);
      if (entries.every((entry): entry is SnapshotDirectoryEntry =>
        typeof entry !== "string")) {
        return entries;
      }
      throw new TypeError("Snapshot directory entry metadata is invalid.");
    }
    const entries = await filesystem.readdir(path);
    if (entries.every((entry): entry is string => typeof entry === "string")) {
      return entries;
    }
    throw new TypeError("Snapshot directory names are invalid.");
  }
  return { ...filesystem, readdir };
}

function projectedSummary(projected: unknown) {
  if (projected === null || typeof projected !== "object"
    || !("digest" in projected) || typeof projected.digest !== "string"
    || !("length" in projected) || typeof projected.length !== "number"
    || !("state" in projected) || projected.state === null
    || typeof projected.state !== "object" || !("sequence" in projected.state)) {
    throw new TypeError("Projected event snapshot returned an invalid summary.");
  }
  return {
    length: projected.length,
    digest: projected.digest,
    sequence: projected.state.sequence,
  };
}

export async function inspectProjectedEventHistory({
  root,
  tree,
  primary,
}: {
  root: string;
  tree: string;
  primary: string;
}) {
  const loaded = await loadConfigSnapshot({ gitRoot: root, tree: primary });
  if (!loaded.config) {
    throw new Error(
      `Invalid primary configuration: ${loaded.diagnostics.map((item) => item.message).join("; ")}`,
    );
  }
  if (loaded.config.version !== 2) {
    return { supported: false, reason: "version-transition" };
  }
  const baseline = withPreciseReaddir(
    createGitSnapshotFileSystem({ gitRoot: root, tree: primary }),
  );
  const candidate = withPreciseReaddir(
    createGitSnapshotFileSystem({ gitRoot: root, tree }),
  );
  const previousIds = snapshotInventory(baseline);
  const ids = snapshotInventory(candidate);
  if ([...previousIds, ...ids].some((id) => !isValidUlid(id))) {
    throw new Error("Historical idea identity is invalid.");
  }
  if (previousIds.some((id) => !ids.includes(id))) {
    throw new Error("Removing an integrated idea is not an event repair.");
  }
  if (previousIds.some((id) =>
    baseline.snapshotEntry(ideaPaths(id).eventsPath)?.type !== "blob")
    || ids.some((id) =>
      candidate.snapshotEntry(ideaPaths(id).eventsPath)?.type !== "blob")) {
    return { supported: false, reason: "storage-transition" };
  }
  const options = { objectIdLength: primary.length };
  const results: Record<string, unknown>[] = [];
  for (const id of ids) {
    const paths = ideaPaths(id);
    const next = await projectEventSnapshot(root, id, paths, options, candidate);
    if (!previousIds.includes(id)) {
      results.push({ id, mode: "initialization", candidate: projectedSummary(next) });
      continue;
    }
    let previous;
    try {
      previous = await projectEventSnapshot(root, id, paths, options, baseline);
    } catch (cause) {
      if (!(cause instanceof ProjectedReductionError)) throw cause;
      const reduction = "result" in cause ? cause.result : undefined;
      return {
        supported: false,
        reason: "primary-reduction-failed",
        id,
        reduction,
      };
    }
    if (await snapshotEventPrefix(
      root,
      paths,
      options,
      candidate,
      previous.length,
    ) !== previous.digest) {
      throw new Error(`${id}: not-append-only (append)`);
    }
    results.push({
      id,
      mode: "append",
      base: projectedSummary(previous),
      candidate: projectedSummary(next),
    });
  }
  return {
    supported: true,
    valid: true,
    detail: "summary",
    target: "candidate",
    baseline: { commit: primary, source: "fetched-primary", ref: null },
    results,
  };
}

async function inspectBoundHistory({
  root,
  tree,
  commit,
  overrides,
  baseline,
}: BoundHistoryOptions) {
  const blobs = new Map<string, Buffer>();
  const primaryCommit = resolveCommit(root, baseline.commit);
  const target = await snapshot(root, tree, overrides, commit, blobs);
  const options = { objectIdLength: primaryCommit.length };
  const results = [];
  const targetCommit = commit === undefined ? null : resolveCommit(root, commit);
  const parent = targetCommit ? firstParent(root, targetCommit) : null;
  const baseCommit = targetCommit ? parent : primaryCommit;
  const base = baseCommit
    ? await snapshot(root, baseCommit, undefined, baseCommit, blobs)
    : await snapshot(root, tree, undefined, undefined, blobs);
  if (!baseCommit) {
    base.version = null;
    base.ids = [];
    base.entries = [];
    base.format = null;
  }
  noDeletion(base, target);
  if (target.version === 2) {
    for (const id of target.ids) {
      results.push(transition(root, base, target, id, options));
    }
  }
  return {
    valid: true,
    baseline,
    target: targetCommit ? "commit" : "candidate",
    ...(targetCommit ? { parent: baseCommit } : {}),
    results,
  };
}
