import { resolve } from "node:path";

import { inspectAdoption } from "../foundation/skill-registration/index.ts";
import { serializeConfig } from "../foundation/project-config/index.ts";
import { parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "../foundation/event-codec/index.ts";
import { inspectIdeaLayout } from "./shared/index.ts";
import { parseIdeaStatus } from "../foundation/idea-model/index.ts";
import { inspectRepositoryState, worktreeSnapshot } from "../foundation/git/index.ts";
import { CONFIG_PATH, ideaPaths } from "../foundation/coordinates/index.ts";
import { digest, recoverStateTransaction, regularBytes, stateTransaction } from "../foundation/state-transaction/index.ts";
import { isDeepStrictEqual } from "node:util";

interface MigrationOptions {
  root?: string;
  apply?: boolean;
  expectedDigest?: string;
  resume?: boolean;
  rollback?: boolean;
  confirmStopped?: boolean;
  afterStep?: (step: string) => void | Promise<void>;
}

function migrationEvents(status: ReturnType<typeof parseIdeaStatus>) {
  const events: object[] = [];
  const append = (type: string, payload?: Record<string, string>) => {
    events.push({
      sequence: events.length + 1,
      type,
      ...(payload === undefined ? {} : { payload }),
    });
  };
  if (status.alias !== undefined) append("setAlias", { alias: status.alias });
  if (status.language !== undefined) append("setLanguage", { language: status.language });
  if (status.approvedRevision !== undefined) {
    append("acceptIdeal", { idealRevision: status.approvedRevision });
  }
  if (status.implementationAcceptedRevision !== undefined) {
    append("acceptInner", {
      implementationRevision: status.implementationAcceptedRevision,
    });
  }
  if (status.deploymentAcceptedRevision !== undefined) {
    append("acceptOuter", {
      deploymentRevision: status.deploymentAcceptedRevision,
    });
  }
  if (status.abandoned) append("abandon");
  return events;
}

export async function migrateEvents({
  root = process.cwd(), apply = false, expectedDigest,
  resume = false, rollback = false, confirmStopped = false, afterStep,
}: MigrationOptions = {}) {
  root = resolve(root);
  const adoption = await inspectAdoption({ root });
  const blockers = adoption.findings.filter((finding) => {
    const sourceDiagnostic: unknown = "sourceDiagnostic" in finding
      ? finding.sourceDiagnostic
      : undefined;
    return !((resume || rollback)
      && sourceDiagnostic !== null
      && typeof sourceDiagnostic === "object"
      && "message" in sourceDiagnostic
      && typeof sourceDiagnostic.message === "string"
      && sourceDiagnostic.message.includes("Unfinished state transaction"));
  });
  if (blockers.length) {
    const summaries = blockers.flatMap(({ problem }) =>
      problem === undefined ? [] : [problem.summary]
    );
    throw new Error(summaries.join("; "));
  }
  root = adoption.root;
  if (resume || rollback) {
    const validate: NonNullable<
      NonNullable<Parameters<typeof recoverStateTransaction>[1]>["validate"]
    > = (plan) => {
      const sourceCommit = plan.context !== null
        && typeof plan.context === "object"
        && "sourceCommit" in plan.context
        && typeof plan.context.sourceCommit === "string"
        ? plan.context.sourceCommit
        : undefined;
      if (inspectRepositoryState(root).head !== sourceCommit) {
        throw new Error("Migration source commit changed; preserve the transaction rather than discarding potentially integrated facts.");
      }
    };
    return recoverStateTransaction(root, {
      rollback, confirmedStopped: confirmStopped, kind: "migration", validate, validateRollback: validate,
    });
  }
  const config = adoption.config;
  if (config === null) {
    throw new Error("Migration requires a valid Silvermoon project configuration.");
  }
  const { tree } = worktreeSnapshot(root);
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  if (config.version === 2) return { outcome: "already-v2", written: false };
  const files: { path: string; before: Buffer | null; after: Buffer | null }[] = [];
  for (const idea of layout.ideas) {
    const paths = ideaPaths(idea.id);
    const before = await regularBytes(resolve(root, paths.statusPath));
    if (before === null) throw new Error(`Missing migration source: ${paths.statusPath}`);
    if (await regularBytes(resolve(root, paths.eventsPath)) !== null) {
      throw new Error(`Refusing to overwrite existing ${paths.eventsPath}`);
    }
    const eventOptions = { objectIdLength: tree.length };
    const status = parseIdeaStatus(before.toString("utf8"), eventOptions);
    const after = Buffer.from(serializeIdeaEvents(
      migrationEvents(status),
      eventOptions,
    ));
    const result = replayIdeaEvents(idea.id, parseIdeaEvents(after, eventOptions), eventOptions);
    if (!result.ok || !("state" in result)
      || !isDeepStrictEqual({ version: 1, ...result.state.status }, status)) {
      throw new Error(`Migration projection differs for ${idea.id}`);
    }
    files.push(
      { path: paths.eventsPath, before: null, after },
      { path: paths.statusPath, before, after: null },
    );
  }
  files.push({
    path: CONFIG_PATH,
    before: await regularBytes(resolve(root, CONFIG_PATH)),
    after: Buffer.from(serializeConfig({
      version: 2,
      primaryRepository: config.primaryRepository,
      primaryBranch: config.primaryBranch,
      ...(config.preferredLanguage === undefined
        ? {}
        : { preferredLanguage: config.preferredLanguage }),
    })),
  });
  const attributes = await regularBytes(resolve(root, ".gitattributes"));
  const attributeRule = "**/events.jsonl -text -filter";
  if (!attributes?.toString("utf8").split(/\r?\n/).includes(attributeRule)) {
    files.push({
      path: ".gitattributes", before: attributes,
      after: Buffer.concat([
        attributes ?? Buffer.alloc(0),
        Buffer.from(attributes?.length && attributes.at(-1) !== 10 ? "\n" : ""),
        Buffer.from(`${attributeRule}\n`),
      ]),
    });
  }
  const fingerprint = digest(JSON.stringify(files.map(({ path, before, after }) => ({
    path, before: before === null ? null : digest(before), after: after === null ? null : digest(after),
  }))));
  const receipt = {
    outcome: "migration-planned", written: false, digest: fingerprint,
    ideas: layout.ideas.map(({ id }) => id),
    note: "Ordinary events reconstruct known facts in representation order, not historical chronology.",
  };
  if (!apply) return receipt;
  if (expectedDigest !== fingerprint) throw new Error("Migration plan changed; observe and confirm its exact digest before applying.");
  const repository = inspectRepositoryState(root);
  if (repository.changes.conflicted.length || repository.changes.staged.length
    || repository.changes.unstaged.length || repository.changes.untracked.length) {
    throw new Error("Migration requires a clean committed source; preserve all work before retrying.");
  }
  await stateTransaction(root, "migration", files, {
    ...(afterStep === undefined ? {} : { afterStep }),
    context: { sourceCommit: repository.head },
  });
  return { ...receipt, outcome: "migrated", written: true };
}
