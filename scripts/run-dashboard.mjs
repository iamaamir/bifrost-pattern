import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPatternStore } from "./pattern-store.mjs";

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

function evidenceWorkers(project, store, id, fallback) {
  const terminals = readLines(join(store.root, "runs", `${id}.events.jsonl`)).filter(event => event.type === "worker_terminal");
  if (!terminals.length) return fallback;
  const routes = readLines(join(project, ".pi", "bifrost-debug.jsonl")).filter(event => event.pattern_run_id === id && event.event === "total");
  const unique = new Map();
  for (const worker of terminals) unique.set(worker.runId, worker);
  return [...unique.values()].map(worker => {
    const route = routes.find(candidate => candidate.subagent_run_id === worker.runId);
    return { agent: worker.agent, success: worker.success, model: route?.model ?? worker.model, tier: route?.tier, verified: Boolean(route), durationSeconds: worker.durationMs === undefined ? undefined : Math.round(worker.durationMs / 1000), errorKind: worker.errorKind };
  });
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
      workers: evidenceWorkers(project, store, ledger.runId, (ledger.workers ?? []).map(worker => ({ agent: worker.agent, success: worker.success, model: worker.routing?.model, tier: worker.routing?.tier, verified: worker.routing?.verified, durationSeconds: worker.durationMs === undefined ? undefined : Math.round(worker.durationMs / 1000) }))),
      tokens: ledger.tokens,
      cleanup: ledger.cleanup,
    };
  }).sort((left, right) => String(right.startedAt ?? "").localeCompare(String(left.startedAt ?? "")));
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
  workers: report => `Workers:\n${report.workers.length ? report.workers.map(worker => `  ${worker.success === false ? "✗" : "✓"} ${worker.agent ?? "unknown"}  ${worker.model ?? "unavailable"}${worker.tier ? `  tier ${worker.tier}` : ""}${worker.durationSeconds === undefined ? "" : `  ${duration(worker.durationSeconds)}`}`).join("\n") : "  none recorded"}`,
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
