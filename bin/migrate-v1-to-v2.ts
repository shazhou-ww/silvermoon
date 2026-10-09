#!/usr/bin/env node
import { Command } from "commander";
import { runSchemaMigration } from "../src/business/schema-migration.ts";

const program = new Command()
  .name("silvermoon-migrate-v1-to-v2")
  .description("Explicit one-time project migration; defaults to a read-only plan")
  .option("--root <path>", "project root", process.cwd())
  .option("--apply", "apply the exact confirmed plan")
  .option("--expected-digest <sha256>", "digest returned by the read-only plan")
  .option("--resume", "complete an interrupted migration")
  .option("--rollback", "restore an interrupted migration's original files")
  .option("--confirm-stopped", "confirm the interrupted writer has stopped");

try {
  program.parse();
  const options = program.opts<{
    apply?: boolean;
    confirmStopped?: boolean;
    expectedDigest?: string;
    resume?: boolean;
    rollback?: boolean;
    root: string;
  }>();
  if ([options.apply, options.resume, options.rollback].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --apply, --resume or --rollback.");
  }
  console.log(JSON.stringify(
    await runSchemaMigration("project-v1-to-v2", options),
    null,
    2,
  ));
} catch (error) {
  console.error(`ERROR migration.failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
