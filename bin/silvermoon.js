#!/usr/bin/env node

const bootstrapStartedAt = process.hrtime.bigint();
const { runCli } = await import("../src/cli/index.js");

process.exitCode = await runCli(
  process.argv.slice(2),
  console,
  { bootstrapStartedAt },
);
