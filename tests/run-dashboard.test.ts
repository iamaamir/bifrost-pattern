import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dashboardView, loadRunReports, renderTerminal } from "../scripts/run-dashboard.mjs";

function writeSession(root: string, workerKey: string, agent: string, model: string) {
  const session = join(root, "sessions", "outer", workerKey, "run-0");
  mkdirSync(session, { recursive: true });
  writeFileSync(join(session, "session.jsonl"), [
    JSON.stringify({ type: "session", version: 3, id: `${workerKey}-session`, timestamp: "2026-07-29T08:00:30.000Z", cwd: "/repo" }),
    JSON.stringify({ type: "session_info", id: `${workerKey}-info`, parentId: "parent", timestamp: "2026-07-29T08:00:31.000Z", name: `subagent-${agent}-${workerKey}-1` }),
    JSON.stringify({ type: "model_change", id: `${workerKey}-model`, parentId: `${workerKey}-info`, timestamp: "2026-07-29T08:00:32.000Z", modelId: model }),
  ].join("\n") + "\n");
}

test("projects redacted ledgers into configurable terminal dashboard", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-dashboard-"));
  const runs = join(project, ".pi", "bifrost-patterns", "runs");
  mkdirSync(runs, { recursive: true });
  writeFileSync(join(runs, "run-1.events.jsonl"), `${JSON.stringify({ type: "worker_terminal", runId: "worker-1", agent: "scout", success: true, durationMs: 18000 })}\n`);
  writeFileSync(join(project, ".pi", "bifrost-debug.jsonl"), `${JSON.stringify({ pattern_run_id: "run-1", subagent_run_id: "worker-1", event: "model_selected", model: "opencode/mini-mo", tier: "quick" })}\n`);
  writeFileSync(join(runs, "run-1.json"), JSON.stringify({
    runId: "run-1", recipe: "repo-onboarding", startedAt: "2026-07-29T08:00:00.000Z", endedAt: "2026-07-29T08:02:00.000Z",
    outerModel: "provider/outer", outcome: "completed", routingVerified: true,
    workers: []
  }));

  const [report] = loadRunReports(project, { now: new Date("2026-07-29T08:03:00.000Z") });
  assert.equal(report.active, false);
  assert.equal(report.durationSeconds, 120);
  assert.equal(report.workers[0].model, "opencode/mini-mo");
  assert.equal(report.workers[0].durationSeconds, 18);
  assert.equal(report.tokens, undefined);
  writeFileSync(join(project, ".pi", "bifrost-patterns", "dashboard.json"), JSON.stringify({ fields: ["recipe", "workers", "tokens"] }));
  const output = renderTerminal(report, dashboardView(project));
  assert.match(output, /repo-onboarding/);
  assert.match(output, /scout/);
  assert.match(output, /Tokens: unavailable/);
});

test("uses nested session logs when worker lifecycle events are incomplete", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-dashboard-"));
  const runs = join(project, ".pi", "bifrost-patterns", "runs");
  const runDirectory = join(project, ".pi", "bifrost-patterns", "outer-runs", "run-2");
  mkdirSync(runs, { recursive: true });
  writeFileSync(join(runs, "run-2.events.jsonl"), `${JSON.stringify({ type: "worker_requested", agent: "reviewer" })}\n`);
  writeSession(runDirectory, "a16011c5", "reviewer", "openai/reviewer-mini");
  writeFileSync(join(runs, "run-2.json"), JSON.stringify({
    runId: "run-2",
    recipe: "fixed-orchestrator-workers",
    startedAt: "2026-07-29T09:00:00.000Z",
    outerModel: "provider/outer",
    outcome: "running",
  }));

  const [report] = loadRunReports(project, { now: new Date("2026-07-29T09:01:00.000Z") });
  assert.equal(report.active, true);
  assert.equal(report.workers.length, 1);
  assert.equal(report.workers[0].status, "running");
  assert.equal(report.workers[0].model, "openai/reviewer-mini");
  const output = renderTerminal(report, dashboardView(project));
  assert.match(output, /reviewer/);
  assert.match(output, /openai\/reviewer-mini/);
  assert.doesNotMatch(output, /model pending/);
});

test("uses live monitor state before finalize", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-dashboard-"));
  const runs = join(project, ".pi", "bifrost-patterns", "runs");
  const runDirectory = join(project, ".pi", "bifrost-patterns", "outer-runs", "run-3");
  mkdirSync(runs, { recursive: true });
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(runDirectory, "monitor.json"), JSON.stringify({
    workers: [
      { runId: "worker-3", agent: "reviewer", status: "running", model: "openai/reviewer-mini", durationMs: 21000, verified: true },
    ],
  }));
  writeFileSync(join(runs, "run-3.json"), JSON.stringify({
    runId: "run-3",
    recipe: "fixed-orchestrator-workers",
    startedAt: "2026-07-29T10:00:00.000Z",
    outerModel: "provider/outer",
    outcome: "running",
  }));

  const [report] = loadRunReports(project, { now: new Date("2026-07-29T10:01:00.000Z") });
  assert.equal(report.active, true);
  assert.equal(report.workers.length, 1);
  assert.equal(report.workers[0].source, "monitor");
  assert.equal(report.workers[0].status, "running");
  assert.equal(report.workers[0].model, "openai/reviewer-mini");
  assert.equal(report.workers[0].durationSeconds, 21);
});
