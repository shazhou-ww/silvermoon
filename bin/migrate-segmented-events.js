#!/usr/bin/env node
import { Command } from "commander";
import { migrateSegmentedEvents } from "../src/migrate-segmented-events.js";

const program = new Command()
  .name("migrate-segmented-events")
  .description("Source-only unpublished V2 segmentation; defaults to a read-only plan")
  .option("--root <path>", "source checkout root", process.cwd())
  .option("--apply", "apply the exact confirmed plan")
  .option("--expected-digest <sha256>", "digest returned by the read-only plan")
  .option("--resume", "complete an interrupted migration")
  .option("--rollback", "restore exact operation-owned source bytes")
  .option("--confirm-stopped", "confirm the original writer has stopped");

try {
  program.parse();
  const options = program.opts();
  if ([options.apply, options.resume, options.rollback].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --apply, --resume or --rollback.");
  }
  console.log(JSON.stringify(await migrateSegmentedEvents(options), null, 2));
} catch (error) {
  console.error(`ERROR migration.failed: ${error.message}`);
  process.exitCode = 1;
}
