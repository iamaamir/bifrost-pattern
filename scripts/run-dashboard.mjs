import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPatternStore } from "./pattern-store.mjs";
import { collectRunWorkers } from "./run-workers.mjs";

const defaultFields = ["recipe", "outcome", "outerModel", "workers", "tokens"];

export function dashboardView(project) {
  const config = readJson(join(createPatternStore(project).root, "dashboard.json"));
  return Array.isArray(config?.fields) ? { fields: config.fields.filter(field => typeof field === "string") } : { fields: defaultFields };
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
}

function readLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return undefined; }
  }).filter(Boolean);
}

function durationSeconds(startedAt, endedAt, now) {
  const start = Date.parse(startedAt ?? "");
  const end = Date.parse(endedAt ?? "") || now.getTime();
  return Number.isFinite(start) ? Math.max(0, Math.round((end - start) / 1000)) : undefined;
}

export function loadRunReports(project, { now = new Date() } = {}) {
  const store = createPatternStore(project);
  const directory = join(store.root, "runs");
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(name => name.endsWith(".json")).map(name => readJson(join(directory, name))).filter(Boolean).map(ledger => {
    const feedback = readJson(join(store.runs.directory(ledger.runId), "feedback.json"));
    return {
      id: ledger.runId,
      recipe: ledger.recipe ?? feedback?.recipe ?? "unknown",
      outcome: ledger.outcome ?? "running",
      active: !ledger.endedAt && ledger.outcome === "running",
      startedAt: ledger.startedAt,
      endedAt: ledger.endedAt,
      durationSeconds: durationSeconds(ledger.startedAt, ledger.endedAt, now),
      outerModel: ledger.outerModel,
      routingVerified: ledger.routingVerified,
      workers: collectRunWorkers({
        project,
        runDirectory: store.runs.directory(ledger.runId),
        runId: ledger.runId,
        events: readLines(join(store.root, "runs", `${ledger.runId}.events.jsonl`)),
        routes: readLines(join(project, ".pi", "bifrost-debug.jsonl")).filter(event => event.pattern_run_id === ledger.runId && ["model_selected", "total"].includes(event.event)),
        now,
        phase: ledger.endedAt ? "final" : "live",
      }),
      tokens: ledger.tokens,
      cleanup: ledger.cleanup,
    };
  }).sort((left, right) => String(right.startedAt ?? "").localeCompare(String(left.startedAt ?? "")));
}

export function findRunReport(project, runId, options) {
  return loadRunReports(project, options).find(report => report.id === runId);
}

function duration(value) {
  if (value === undefined) return "unavailable";
  const minutes = Math.floor(value / 60);
  return minutes ? `${minutes}m ${value % 60}s` : `${value}s`;
}

const fields = {
  recipe: report => `Recipe: ${report.recipe}`,
  outcome: report => `Outcome: ${report.active ? "● running" : report.outcome}`,
  outerModel: report => `Outer: ${report.outerModel ?? "unavailable"}`,
  workers: report => `Workers:\n${report.workers.length ? report.workers.map(worker => `  ${worker.status === "running" ? "●" : worker.status === "requested" ? "○" : worker.success === false ? "✗" : "✓"} ${worker.agent ?? "unknown"}  ${worker.model ?? (worker.status === "requested" ? "model pending" : worker.status === "running" ? "spawned" : "not selected")}${worker.tier ? `  tier ${worker.tier}` : ""}${worker.durationSeconds === undefined ? "" : `  ${duration(worker.durationSeconds)}`}`).join("\n") : "  none recorded"}`,
  tokens: report => `Tokens: ${report.tokens ?? "unavailable"}`,
  duration: report => `Duration: ${duration(report.durationSeconds)}`,
  cleanup: report => `Cleanup: ${report.cleanup ?? "unavailable"}`,
};

export function renderTerminal(report, { fields: selected = defaultFields } = {}) {
  const output = [`Run: ${report.id}`, `Duration: ${duration(report.durationSeconds)}`];
  for (const field of selected) if (fields[field]) output.push(fields[field](report));
  return `${output.join("\n")}\n`;
}

export function pickerRows(reports) {
  return reports.map(report => `${report.startedAt?.replace("T", " ").slice(0, 16) ?? "unknown"}  ${report.active ? "● running" : report.outcome}  ${report.recipe}  ${report.workers.length} workers  ${report.id}`);
}
