import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { copyFileSync, lstatSync, mkdtempSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runSubprocess } from "./subprocess.js";
import { traceAsync } from "./trace.js";

let commandObserver = null;

function executeGit(root, args, { encoding, env, input } = {}) {
  if (commandObserver) commandObserver([...args]);
  return runSubprocess(
    "git",
    root === null ? args : ["-C", root, ...args],
    {
      encoding,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
      input,
      windowsHide: true,
    },
    {
      spanName: "git.command",
      attributes: {
        argumentCount: args.length - 1,
        network: args[0] === "fetch" || args[0] === "ls-remote",
        subcommand: args[0] ?? null,
      },
    },
  );
}

export function runGit(root, args, { env, input } = {}) {
  const result = executeGit(root, args, { encoding: "utf8", env, input });
  return {
    error: result.error ?? null,
    ok: result.status === 0,
    status: result.status,
    stderr: result.stderr?.trim() ?? "",
    stdout: result.stdout?.trim() ?? "",
  };
}

export async function observeGitCommands(observer, callback) {
  if (commandObserver) throw new Error("Git command observation is already active");
  commandObserver = observer;
  try {
    return await callback();
  } finally {
    commandObserver = null;
  }
}

export function sanitizeGitMessage(value) {
  return String(value)
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+)@/gi,
      "$1[redacted]@",
    )
    .replace(
      /([?&](?:access_token|auth|credential|key|password|signature|token)=)[^&#\s]+/gi,
      "$1[redacted]",
    )
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[redacted]");
}

function requireGit(root, args, label, options) {
  const result = runGit(root, args, options);
  if (!result.ok) {
    const safeResult = {
      ...result,
      stderr: sanitizeGitMessage(result.stderr),
    };
    const error = new Error(`${label}: ${safeResult.stderr || result.error?.message || "Git failed"}`);
    error.git = safeResult;
    throw error;
  }
  return result.stdout;
}

function parseTreeEntries(source, label) {
  const entries = [];
  for (const record of source.split("\0")) {
    if (!record) continue;
    const match = /^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\t([\s\S]+)$/
      .exec(record);
    if (!match) throw new Error(`Cannot parse ${label} entry`);
    entries.push({
      mode: match[1],
      type: match[2],
      object: match[3],
      name: match[4],
    });
  }
  return entries;
}

function parseLongTreeEntries(source, label) {
  const entries = [];
  for (const record of source.split("\0")) {
    if (!record) continue;
    const match = /^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64}) +(-|(?:0|[1-9]\d*))\t([\s\S]+)$/
      .exec(record);
    if (!match) throw new Error(`Cannot parse ${label} entry`);
    entries.push({
      mode: match[1],
      type: match[2],
      object: match[3],
      size: match[4] === "-" ? null : Number(match[4]),
      name: match[5],
    });
  }
  return entries;
}

export function inspectTreeEntry(root, tree, path) {
  const output = requireGit(
    root,
    ["ls-tree", "-z", tree, "--", path],
    `Cannot inspect snapshot path ${path}`,
  );
  const entries = parseTreeEntries(output, `snapshot path ${path}`);
  if (entries.length === 0) return null;
  if (entries.length !== 1 || entries[0].name !== path) {
    throw new Error(`Snapshot path ${path} did not resolve exactly once`);
  }
  return entries[0];
}

export function listTreeEntries(root, tree, path) {
  const output = requireGit(
    root,
    ["ls-tree", "-z", tree],
    `Cannot inspect snapshot directory ${path}`,
  );
  return parseTreeEntries(output, `snapshot directory ${path}`);
}

export function inspectTree(root, tree, path) {
  return inspectTreeLineage(root, tree, path)
    .filter((entry) =>
      entry.name === path || entry.name.startsWith(`${path}/`)
    );
}

export function inspectTreeLineage(root, tree, path) {
  const output = requireGit(
    root,
    ["ls-tree", "-r", "-t", "-l", "-z", tree, "--", path],
    `Cannot inspect snapshot tree ${path}`,
  );
  return parseLongTreeEntries(output, `snapshot tree ${path}`);
}

export function gitObjectSize(root, object) {
  const output = requireGit(
    root,
    ["cat-file", "-s", object],
    `Cannot inspect Git object ${object}`,
  );
  if (!/^(?:0|[1-9]\d*)$/.test(output)) {
    throw new Error(`Cannot parse size for Git object ${object}`);
  }
  return Number(output);
}

export function readGitBlob(root, object) {
  const result = executeGit(
    root,
    ["cat-file", "blob", object],
    { encoding: null },
  );
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    throw new Error(
      `Cannot read Git blob ${object}: `
      + `${sanitizeGitMessage(stderr?.trim() || result.error?.message || "Git failed")}`,
    );
  }
  return Buffer.from(result.stdout);
}

export function readGitBlobs(root, objects) {
  const requested = [...new Set(objects)];
  if (requested.length === 0) return new Map();
  const result = executeGit(
    root,
    ["cat-file", "--batch"],
    {
      encoding: null,
      input: Buffer.from(`${requested.join("\n")}\n`, "utf8"),
    },
  );
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    throw new Error(
      "Cannot read Git blobs: "
      + `${sanitizeGitMessage(stderr?.trim() || result.error?.message || "Git failed")}`,
    );
  }

  const source = Buffer.from(result.stdout);
  const blobs = new Map();
  let offset = 0;
  for (const object of requested) {
    const headerEnd = source.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`Missing Git blob header for ${object}`);
    const header = source.subarray(offset, headerEnd).toString("utf8");
    const match = /^([0-9a-f]{40}|[0-9a-f]{64}) blob (0|[1-9]\d*)$/
      .exec(header);
    if (!match || match[1] !== object) {
      throw new Error(`Cannot parse Git blob header for ${object}`);
    }
    const size = Number(match[2]);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= source.length || source[contentEnd] !== 0x0a) {
      throw new Error(`Incomplete Git blob content for ${object}`);
    }
    blobs.set(object, source.subarray(contentStart, contentEnd));
    offset = contentEnd + 1;
  }
  if (offset !== source.length) {
    throw new Error("Unexpected trailing Git blob batch output");
  }
  return blobs;
}

export function inspectTreePaths(root, tree, paths) {
  if (paths.length === 0) return new Map();
  const input = `${paths.map((path) => `${tree}:${path}`).join("\n")}\n`;
  const output = requireGit(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype)"],
    "Cannot inspect snapshot world trees",
    { input },
  );
  const lines = output.split(/\r?\n/);
  if (lines.length !== paths.length) {
    throw new Error(
      `Cannot inspect snapshot world trees: expected ${paths.length} result(s), received ${lines.length}`,
    );
  }
  return new Map(paths.map((path, index) => {
    const [object, type, ...unexpected] = lines[index].split(" ");
    if (!object || !type || unexpected.length > 0) {
      throw new Error(`Cannot parse snapshot world tree result for ${path}`);
    }
    return [path, { object: type === "missing" ? null : object, type }];
  }));
}

function preciseIndexSources(root, env) {
  const output = requireGit(root, ["ls-files", "--stage", "--debug", "-z"],
    "Cannot inspect cached snapshot sources", { env });
  const sources = [];
  const replacements = [];
  let position = 0;
  while (position < output.length) {
    const end = output.indexOf("\0", position);
    const entry = /^([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])\t([\s\S]+)$/
      .exec(output.slice(position, end));
    const stats = /^  ctime: ([0-9]+):([0-9]+)\n  mtime: ([0-9]+):([0-9]+)\n  dev: [^\n]*\n  uid: [^\n]*\n  size: [0-9]+\tflags: [0-9a-f]+(?:\n|$)/
      .exec(output.slice(end + 1));
    if (end < 0 || !entry || !stats) throw new Error("Cannot parse cached snapshot source metadata.");
    const path = join(root, entry[4]);
    let metadata;
    try { metadata = lstatSync(path, { bigint: true }); }
    catch (cause) { if (cause.code !== "ENOENT") throw cause; }
    const fingerprint = (value) => value
      ? `${value.ctimeNs}:${value.mtimeNs}:${value.size}:${value.ino}:${value.dev}:${value.mode}`
      : null;
    sources.push({ path, fingerprint: fingerprint(metadata), inspect: fingerprint });
    // Git may ignore subsecond ctime even when the index records it.
    if (entry[3] === "0" && metadata
      && (metadata.ctimeNs % 1000000000n === 0n
        || metadata.ctimeNs !== BigInt(stats[1]) * 1000000000n + BigInt(stats[2])
        || metadata.mtimeNs !== BigInt(stats[3]) * 1000000000n + BigInt(stats[4]))) {
      replacements.push(`${entry[1]} ${entry[2]}\t${entry[4]}\0`);
    }
    position = end + 1 + stats[0].length;
  }
  if (replacements.length) {
    requireGit(root, ["update-index", "-z", "--index-info"], "Cannot invalidate changed snapshot sources",
      { env, input: replacements.join("") });
  }
  return sources;
}

export function worktreeSnapshot(root, { paths, reuseIndex = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "silvermoon-index-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(directory, "index") };
  try {
    let copied = false;
    if (reuseIndex && paths === undefined && process.platform !== "win32") {
      const index = requireGit(root, ["rev-parse", "--path-format=absolute", "--git-path", "index"],
        "Cannot locate worktree index");
      try {
        const metadata = statSync(index);
        copyFileSync(index, env.GIT_INDEX_FILE);
        // A newer index timestamp would hide entries that Git considers racy.
        utimesSync(env.GIT_INDEX_FILE, metadata.atime, metadata.mtime);
        copied = true;
      } catch (cause) {
        if (cause.code !== "ENOENT") throw cause;
      }
    }
    let sources;
    if (copied) {
      const tracked = requireGit(root, ["ls-files", "-z"], "Cannot inspect snapshot index", { env });
      if (tracked) {
        requireGit(root, ["update-index", "--no-assume-unchanged", "-z", "--stdin"],
          "Cannot clear snapshot assume-unchanged flags", { env, input: tracked });
        requireGit(root, ["update-index", "--no-skip-worktree", "-z", "--stdin"],
          "Cannot clear snapshot skip-worktree flags", { env, input: tracked });
      }
      sources = preciseIndexSources(root, env);
    } else {
      const populated = runGit(root, ["read-tree", "HEAD"], { env });
      if (!populated.ok) {
        requireGit(root, ["read-tree", "--empty"], "Cannot initialize snapshot index", { env });
      }
    }
    const add = ["add", "--all"];
    if (paths !== undefined) add.push("--", ...paths);
    requireGit(root, copied ? [
      "-c", "core.fsmonitor=false", "-c", "core.ignorestat=false",
      "-c", "core.trustctime=true", "-c", "core.checkstat=default", ...add,
    ] : add, "Cannot snapshot worktree", { env });
    for (const source of sources ?? []) {
      let metadata;
      try { metadata = lstatSync(source.path, { bigint: true }); }
      catch (cause) { if (cause.code !== "ENOENT") throw cause; }
      if (source.inspect(metadata) !== source.fingerprint) {
        throw new Error("Worktree source changed while taking its snapshot; preserve changes and reobserve.");
      }
    }
    return {
      tree: requireGit(root, ["write-tree"], "Cannot write worktree snapshot", { env }),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const CHANGE_KINDS = {
  A: "added",
  C: "copied",
  D: "deleted",
  M: "modified",
  R: "renamed",
  T: "type-changed",
  U: "unmerged",
};

const CONFLICT_KINDS = {
  AA: "both-added",
  AU: "added-by-us",
  DD: "both-deleted",
  DU: "deleted-by-us",
  UA: "added-by-them",
  UD: "deleted-by-them",
  UU: "both-modified",
};

function recordFields(record, count) {
  const fields = [];
  let offset = 2;
  for (let index = 0; index < count; index += 1) {
    const separator = record.indexOf(" ", offset);
    if (separator < 0) throw new Error(`Malformed Git status record: ${record}`);
    fields.push(record.slice(offset, separator));
    offset = separator + 1;
  }
  return { fields, path: record.slice(offset) };
}

function changeEntry(path, code, originalPath) {
  const entry = { path, kind: CHANGE_KINDS[code] ?? "unknown" };
  if (originalPath !== undefined) entry.originalPath = originalPath;
  return entry;
}

function sortChanges(changes) {
  changes.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

export function parseWorktreeChanges(source) {
  const result = { staged: [], unstaged: [], untracked: [], conflicted: [] };
  const records = source.split("\0");
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith("? ")) {
      result.untracked.push({ path: record.slice(2) });
      continue;
    }
    if (record.startsWith("! ") || record.startsWith("# ")) continue;
    if (record.startsWith("u ")) {
      const { fields, path } = recordFields(record, 9);
      result.conflicted.push({ path, kind: CONFLICT_KINDS[fields[0]] ?? "unmerged" });
      continue;
    }
    if (record.startsWith("1 ") || record.startsWith("2 ")) {
      const renamed = record.startsWith("2 ");
      const { fields, path } = recordFields(record, renamed ? 8 : 7);
      const [indexCode, worktreeCode] = fields[0];
      const originalPath = renamed ? records[++index] : undefined;
      if (indexCode !== ".") {
        result.staged.push(changeEntry(path, indexCode, originalPath));
      }
      if (worktreeCode !== ".") {
        result.unstaged.push(changeEntry(path, worktreeCode));
      }
      continue;
    }
    throw new Error(`Unsupported Git status record: ${record}`);
  }
  for (const changes of Object.values(result)) sortChanges(changes);
  return result;
}

export function parseRepositoryStatus(source) {
  let branch = null;
  let head = null;
  for (const record of source.split("\0")) {
    if (record.startsWith("# branch.oid ")) {
      const value = record.slice("# branch.oid ".length);
      if (value !== "(initial)") {
        if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value)) {
          throw new Error(`Unsupported Git HEAD object ID: ${value}`);
        }
        head = value;
      }
    } else if (record.startsWith("# branch.head ")) {
      const value = record.slice("# branch.head ".length);
      branch = value === "(detached)" ? null : value;
    }
  }
  return {
    branch,
    changes: parseWorktreeChanges(source),
    head,
  };
}

function escapeConfigKeyPattern(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function parseConfigRecords(source) {
  const values = new Map();
  for (const record of source.split("\0")) {
    if (!record) continue;
    const separator = record.indexOf("\n");
    if (separator < 1) throw new Error("Cannot parse Git configuration record");
    values.set(record.slice(0, separator), record.slice(separator + 1));
  }
  return values;
}

function inspectBranchConfiguration(root, branch) {
  if (branch === null) {
    return { branch: null, remote: null, repository: null, upstreamBranch: null };
  }
  const escapedBranch = escapeConfigKeyPattern(branch);
  const result = runGit(root, [
    "config",
    "--null",
    "--get-regexp",
    `^(branch\\.${escapedBranch}\\.(remote|merge)|remote\\..*\\.url)$`,
  ]);
  const values = result.ok ? parseConfigRecords(result.stdout) : new Map();
  const remote = values.get(`branch.${branch}.remote`) ?? null;
  const merge = values.get(`branch.${branch}.merge`) ?? null;
  const upstreamBranch = merge?.startsWith("refs/heads/")
    ? merge.slice("refs/heads/".length)
    : null;
  const repository = remote === null || remote === "."
    ? null
    : values.get(`remote.${remote}.url`) ?? null;
  return { branch, remote, repository, upstreamBranch };
}

export function inspectRepositoryState(root) {
  const source = requireGit(
    root,
    [
      "status",
      "--porcelain=v2",
      "--branch",
      "--untracked-files=all",
      "-z",
    ],
    "Cannot inspect repository state",
  );
  const status = parseRepositoryStatus(`${source}\0`);
  return {
    changes: status.changes,
    head: status.head,
    branch: inspectBranchConfiguration(root, status.branch),
  };
}

export function inspectWorktreeChanges(root) {
  const source = requireGit(
    root,
    ["status", "--porcelain=v2", "--untracked-files=all", "-z"],
    "Cannot inspect worktree changes",
  );
  return parseWorktreeChanges(`${source}\0`);
}

export function resolveHead(root) {
  const result = runGit(root, ["rev-parse", "--verify", "HEAD^{commit}"]);
  return result.ok ? result.stdout : null;
}

export function inspectCurrentBranch(root) {
  const branch = runGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (!branch.ok) {
    return { branch: null, remote: null, repository: null, upstreamBranch: null };
  }
  const remote = runGit(root, ["config", "--get", `branch.${branch.stdout}.remote`]);
  const merge = runGit(root, ["config", "--get", `branch.${branch.stdout}.merge`]);
  if (!remote.ok || !merge.ok || !merge.stdout.startsWith("refs/heads/")) {
    return {
      branch: branch.stdout,
      remote: remote.ok ? remote.stdout : null,
      repository: null,
      upstreamBranch: merge.ok && merge.stdout.startsWith("refs/heads/")
        ? merge.stdout.slice("refs/heads/".length)
        : null,
    };
  }
  const repository = remote.stdout === "."
    ? null
    : runGit(root, ["config", "--get", `remote.${remote.stdout}.url`]);
  return {
    branch: branch.stdout,
    remote: remote.stdout,
    repository: repository?.ok ? repository.stdout : null,
    upstreamBranch: merge.stdout.slice("refs/heads/".length),
  };
}

export function compareCommits(root, local, remote) {
  if (local === remote) return "aligned";
  const localAncestor = runGit(
    root,
    ["merge-base", "--is-ancestor", local, remote],
  );
  if (localAncestor.ok) {
    return "behind";
  }
  if (localAncestor.status !== 1) {
    throw new Error(
      `Cannot compare local and primary commits: `
      + `${sanitizeGitMessage(localAncestor.stderr || localAncestor.error?.message)}`,
    );
  }
  const remoteAncestor = runGit(
    root,
    ["merge-base", "--is-ancestor", remote, local],
  );
  if (remoteAncestor.ok) {
    return "ahead";
  }
  if (remoteAncestor.status !== 1) {
    throw new Error(
      `Cannot compare local and primary commits: `
      + `${sanitizeGitMessage(remoteAncestor.stderr || remoteAncestor.error?.message)}`,
    );
  }
  const shallow = runGit(root, ["rev-parse", "--is-shallow-repository"]);
  if (!shallow.ok) {
    throw new Error(
      `Cannot determine repository history depth: `
      + `${sanitizeGitMessage(shallow.stderr || shallow.error?.message)}`,
    );
  }
  if (shallow.stdout === "true") return "unknown";
  return "diverged";
}

export function resolveCommit(root, revision) {
  return requireGit(
    root,
    ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
    `Cannot resolve commit ${revision}`,
  );
}

export function resolveSnapshot(root, revision) {
  if (typeof revision !== "string" || /[\0\r\n]/.test(revision)) {
    throw new Error(`Cannot resolve snapshot ${JSON.stringify(revision)}`);
  }
  const expressions = [`${revision}^{commit}`, `${revision}^{tree}`];
  const result = runGit(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype)"],
    { input: `${expressions.join("\n")}\n` },
  );
  if (!result.ok) {
    throw new Error(
      `Cannot resolve snapshot ${revision}: `
      + `${sanitizeGitMessage(result.stderr || result.error?.message || "Git failed")}`,
    );
  }
  const lines = result.stdout.split(/\r?\n/);
  if (lines.length !== 2) {
    throw new Error(`Cannot resolve snapshot ${revision}: unexpected Git output`);
  }
  const parsed = lines.map((line, index) => {
    const match = /^([0-9a-f]{40}|[0-9a-f]{64}) (commit|tree)$/.exec(line);
    if (!match) {
      throw new Error(`Cannot resolve ${expressions[index]}`);
    }
    return { object: match[1], type: match[2] };
  });
  if (parsed[0].type !== "commit" || parsed[1].type !== "tree") {
    throw new Error(`Cannot resolve snapshot ${revision}: invalid object types`);
  }
  return { commit: parsed[0].object, tree: parsed[1].object };
}

export function indexSnapshot(root) {
  return {
    tree: requireGit(root, ["write-tree"], "Cannot snapshot the index"),
  };
}

export function fetchRepositoryBranch(root, repository, branch) {
  const remoteRef = `refs/heads/${branch}`;
  const fetched = requireGit(
    root,
    [
      "fetch",
      "--porcelain",
      "--no-tags",
      repository,
      remoteRef,
    ],
    `Cannot fetch ${branch}`,
  );
  const updates = fetched
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) =>
      fields.length === 4
      && fields[3] === "FETCH_HEAD"
      && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(fields[2])
    );
  if (updates.length !== 1) {
    throw new Error(`Cannot determine fetched commit for branch ${branch}`);
  }
  const primary = updates[0][2];
  return primary;
}

export function fetchPrimary(root, config) {
  return fetchRepositoryBranch(
    root,
    config.primaryRepository,
    config.primaryBranch,
  );
}

export async function withTemporaryWorktree(root, commit, callback) {
  const tree = requireGit(root, ["rev-parse", `${commit}^{tree}`], `Cannot resolve tree for ${commit}`);
  return withTemporaryTree(root, tree, callback);
}

export async function withTemporaryTree(root, tree, callback) {
  return traceAsync("snapshot.materialize", {}, async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "silvermoon-tree-"));
    const directory = join(temporaryRoot, "snapshot");
    const env = { ...process.env, GIT_INDEX_FILE: join(temporaryRoot, "index") };
    try {
      await mkdir(directory);
      requireGit(root, ["read-tree", tree], "Cannot populate isolated index", { env });
      const prefix = `${directory.replaceAll("\\", "/")}/`;
      requireGit(
        root,
        ["checkout-index", "--all", "--force", `--prefix=${prefix}`],
        "Cannot populate isolated tree snapshot",
        { env },
      );
      return await callback(directory, tree);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
}
