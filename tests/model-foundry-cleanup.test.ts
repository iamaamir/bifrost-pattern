import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import cleanup from "../extensions/model-foundry-cleanup.ts";

test("removes detailed Foundry artifacts after completion settles", async () => {
  const run = mkdtempSync(join(tmpdir(), "foundry-cleanup-"));
  mkdirSync(join(run, "model-foundry"));
  mkdirSync(join(run, "agent"));
  writeFileSync(join(run, "model-foundry", "scorecard.json"), "{}");
  let tool: any;
  let settled: (() => void) | undefined;
  cleanup({
    registerTool: (candidate: unknown) => { tool = candidate; },
    on: (name: string, handler: () => void) => { if (name === "agent_settled") settled = handler; },
  } as never);
  const prior = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
  process.env.BIFROST_PATTERN_RUN_DIRECTORY = run;
  await tool.execute("test", { outcome: "proposal" }, new AbortController().signal, () => {}, {});
  settled?.();
  assert.equal(existsSync(join(run, "model-foundry")), false);
  assert.equal(existsSync(join(run, "agent")), false);
  assert.equal(existsSync(join(run, ".model-foundry-complete.json")), true);
  if (prior === undefined) delete process.env.BIFROST_PATTERN_RUN_DIRECTORY;
  else process.env.BIFROST_PATTERN_RUN_DIRECTORY = prior;
  rmSync(run, { recursive: true, force: true });
});
