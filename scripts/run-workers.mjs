import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
}

function readLines(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text.split("\n").map(line => {
    try { return JSON.parse(line); } catch { return undefined; }
  }).filter(Boolean);
}

function parseSessionWorkerName(name) {
  const match = /^subagent-(.+)-([0-9a-f]+)-\d+$/i.exec(String(name ?? ""));
  if (!match) return undefined;
  return { agent: match[1], runId: match[2] };
}

function durationSeconds(startedAt, endedAt, now = new Date()) {
  const start = Date.parse(startedAt ?? "");
  const end = Date.parse(endedAt ?? "") || now.getTime();
  return Number.isFinite(start) ? Math.max(0, Math.round((end - start) / 1000)) : undefined;
}

function readSessionWorkers(runDirectory) {
  const directory = join(runDirectory, "sessions");
  if (!existsSync(directory)) return [];
  const result = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name === "session.jsonl") {
        const entries = readLines(path);
        const info = entries.find(event => event.type === "session_info" && typeof event.name === "string");
        const parsed = parseSessionWorkerName(info?.name);
        if (!parsed) continue;
        const firstTimestamp = entries.find(event => typeof event.timestamp === "string")?.timestamp;
        const lastTimestamp = [...entries].reverse().find(event => typeof event.timestamp === "string")?.timestamp;
        const modelChange = [...entries].reverse().find(event => event.type === "model_change");
        result.push({
          runId: parsed.runId,
          agent: parsed.agent,
          status: "running",
          source: "session",
          sessionId: info?.id,
          model: typeof modelChange?.modelId === "string" ? modelChange.modelId : typeof modelChange?.model === "string" ? modelChange.model : undefined,
          durationSeconds: durationSeconds(firstTimestamp, lastTimestamp),
          verified: true,
          success: undefined,
          path: relative(runDirectory, path),
        });
      }
    }
  }
  return result;
}

function routeFor(routes, runId) {
  return routes.find(candidate => candidate.subagentRunId === runId || candidate.subagent_run_id === runId);
}

function summarizeEventWorker(event, routes, status, extra = {}) {
  const route = routeFor(routes, event.runId);
  return {
    runId: event.runId,
    agent: event.agent,
    status,
    success: event.success,
    model: route?.model ?? event.model ?? extra.model,
    tier: route?.tier,
    verified: Boolean(route),
    durationSeconds: event.durationMs === undefined ? undefined : Math.round(event.durationMs / 1000),
    errorKind: event.errorKind,
    source: "event",
  };
}

function mergeWorkers(items) {
  const byRunId = new Map();
  const ordered = [];
  for (const item of items) {
    const key = item.runId ?? item.sessionId ?? `${item.agent ?? "unknown"}:${ordered.length}`;
    const current = byRunId.get(key);
    if (!current) {
      const next = { ...item };
      byRunId.set(key, next);
      ordered.push(next);
      continue;
    }
    Object.assign(current, {
      ...item,
      model: item.model ?? current.model,
      tier: item.tier ?? current.tier,
      durationSeconds: item.durationSeconds ?? current.durationSeconds,
      verified: current.verified || item.verified,
      success: item.success ?? current.success,
      errorKind: item.errorKind ?? current.errorKind,
      source: current.source === "event" ? current.source : item.source,
    });
  }
  return ordered;
}

export function collectRunWorkers({ project, runDirectory, runId, events, routes, now = new Date(), phase = "live" } = {}) {
  const eventSource = Array.isArray(events) ? events : readLines(join(project, ".pi", "bifrost-patterns", "runs", `${runId}.events.jsonl`));
  const routeSource = Array.isArray(routes) ? routes : readLines(join(project, ".pi", "bifrost-debug.jsonl")).filter(event => event.pattern_run_id === runId && ["model_selected", "total"].includes(event.event));
  const terminals = eventSource.filter(event => event.type === "worker_terminal");
  const started = eventSource.filter(event => event.type === "worker_started");
  const requested = eventSource.filter(event => event.type === "worker_requested");
  const sessionWorkers = runDirectory ? readSessionWorkers(runDirectory) : [];
  const seenAgents = new Set([...terminals, ...started, ...sessionWorkers].map(event => event.agent));
  const workers = [];
  for (const event of terminals) workers.push(summarizeEventWorker(event, routeSource, event.success ? "completed" : "failed"));
  for (const event of started) if (!terminals.some(terminal => terminal.runId === event.runId)) workers.push(summarizeEventWorker(event, routeSource, "running"));
  for (const sessionWorker of sessionWorkers) {
    const existing = workers.find(worker => worker.runId === sessionWorker.runId || (worker.agent === sessionWorker.agent && worker.source === "event" && worker.status !== "requested"));
    if (existing) {
      Object.assign(existing, {
        ...sessionWorker,
        status: existing.status === "completed" || existing.status === "failed" ? existing.status : (phase === "final" ? "completed" : "running"),
        model: existing.model ?? sessionWorker.model,
        durationSeconds: existing.durationSeconds ?? sessionWorker.durationSeconds,
        verified: existing.verified || sessionWorker.verified,
        source: existing.source ?? sessionWorker.source,
      });
    } else {
      workers.push({
        ...sessionWorker,
        status: phase === "final" ? "completed" : "running",
        success: phase === "final" ? true : undefined,
      });
    }
  }
  for (const event of requested) {
    if (seenAgents.has(event.agent)) continue;
    workers.push(summarizeEventWorker(event, routeSource, "requested"));
  }
  return mergeWorkers(workers).map(worker => ({
    ...worker,
    model: worker.model ?? (worker.status === "requested" ? undefined : undefined),
    durationSeconds: worker.durationSeconds ?? durationSeconds(worker.startedAt, worker.endedAt, now),
  }));
}
