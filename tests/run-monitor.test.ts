import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRunMonitor } from "../scripts/run-monitor.mjs";

test("run monitor persists bootstrap and event log", () => {
  const runDirectory = mkdtempSync(join(tmpdir(), "bifrost-monitor-"));
  const monitor = createRunMonitor({
    runDirectory,
    projectPath: "/repo",
    recipe: "fixed-orchestrator-workers",
    outerModel: "provider/model",
    recipeInputs: { discoveryScope: "source-only" },
    preflightArtifacts: {},
  });

  monitor.record("preflight.repo-index", { cacheHit: false, git: { sha: "abc" } });
  monitor.update({ preflightArtifacts: { "repo-index": "/tmp/index.json" }, bootstrap: { git: { sha: "abc" } } });
  monitor.finalize({ outcome: "completed", workers: [], routes: [], activities: [] });

  const json = JSON.parse(readFileSync(join(runDirectory, "monitor.json"), "utf8"));
  assert.equal(json.status, "completed");
  assert.equal(json.outcome, "completed");
  assert.equal(json.bootstrap.git.sha, "abc");
  assert.equal(json.preflightArtifacts["repo-index"], "/tmp/index.json");

  const lines = readFileSync(join(runDirectory, "monitor.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.equal(lines[0].event, "run.start");
  assert.equal(lines.some(line => line.event === "preflight.repo-index"), true);
  assert.equal(lines.at(-1).event, "run.end");

  rmSync(runDirectory, { recursive: true, force: true });
});
