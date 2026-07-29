import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import cleanup from "../extensions/model-foundry-cleanup.ts";

test("removes detailed Foundry artifacts after completion settles", async () => {
  const project = mkdtempSync(join(tmpdir(), "foundry-cleanup-"));
  const run = join(project, ".pi", "bifrost-patterns", "outer-runs", "run-1");
  mkdirSync(join(run, "model-foundry"), { recursive: true });
  mkdirSync(join(run, "agent"));
  writeFileSync(join(run, "model-foundry", "scorecard.json"), "{}");
  let tool: any;
  let settled: (() => void) | undefined;
  cleanup({
    registerTool: (candidate: unknown) => { tool = candidate; },
    on: (name: string, handler: () => void) => { if (name === "agent_settled") settled = handler; },
  } as never);
  const prior = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
  const priorProject = process.env.BIFROST_PATTERN_PROJECT;
  process.env.BIFROST_PATTERN_RUN_DIRECTORY = run;
  process.env.BIFROST_PATTERN_PROJECT = project;
  await tool.execute("test", { outcome: "proposal" }, new AbortController().signal, () => {}, {});
  settled?.();
  assert.equal(existsSync(join(run, "model-foundry")), false);
  assert.equal(existsSync(join(run, "agent")), false);
  assert.equal(existsSync(join(run, ".model-foundry-complete.json")), true);
  if (prior === undefined) delete process.env.BIFROST_PATTERN_RUN_DIRECTORY;
  else process.env.BIFROST_PATTERN_RUN_DIRECTORY = prior;
  if (priorProject === undefined) delete process.env.BIFROST_PATTERN_PROJECT;
  else process.env.BIFROST_PATTERN_PROJECT = priorProject;
  rmSync(project, { recursive: true, force: true });
});
