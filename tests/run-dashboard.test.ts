import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dashboardView, loadRunReports, renderTerminal } from "../scripts/run-dashboard.mjs";

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
