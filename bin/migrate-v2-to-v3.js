#!/usr/bin/env node
import { Command } from "commander";
import { migrateV2ToV3 } from "../src/migrate-v3-events.js";

const program = new Command()
  .name("migrate-v2-to-v3")
  .description("Explicit one-time event migration; defaults to a read-only plan")
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
  console.log(JSON.stringify(await migrateV2ToV3(options), null, 2));
} catch (error) {
  console.error(`ERROR migration.failed: ${error.message}`);
  process.exitCode = 1;
}
