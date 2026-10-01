#!/usr/bin/env node
import { Command } from "commander";
import { migrateInternalEvents } from "../src/migrate-internal-events.js";

const program = new Command()
  .name("migrate-internal-events")
  .description("Explicit one-time Silvermoon source event migration; defaults to a read-only plan")
  .option("--root <path>", "project root", process.cwd())
  .option("--apply", "apply the exact confirmed plan")
  .option("--expected-digest <sha256>", "digest returned by the read-only plan")
  .option("--resume", "complete an interrupted migration")
  .option("--rollback", "restore an interrupted migration's original files")
  .option("--confirm-stopped", "confirm the interrupted writer has stopped");

try {
  program.parse();
  const options = program.opts();
  if ([options.apply, options.resume, options.rollback].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --apply, --resume or --rollback.");
  }
  console.log(JSON.stringify(await migrateInternalEvents(options), null, 2));
} catch (error) {
  console.error(`ERROR migration.failed: ${error.message}`);
  process.exitCode = 1;
}
