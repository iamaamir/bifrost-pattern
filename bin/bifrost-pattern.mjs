#!/usr/bin/env node

if (process.argv[2] === "init") {
  process.argv.splice(2, 1);
  await import("../scripts/init-bifrost.mjs");
} else {
  await import("../scripts/run-pattern.mjs");
}
