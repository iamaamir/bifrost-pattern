import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function appendJson(path: string | undefined, event: Record<string, unknown>) {
  if (!path) return;
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function readJson(path: string | undefined) {
  if (!path) return undefined;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
}

function writeJson(path: string | undefined, value: unknown) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function updateMonitor(event: Record<string, unknown>) {
  const jsonPath = process.env.BIFROST_PATTERN_MONITOR_PATH;
  const logPath = process.env.BIFROST_PATTERN_MONITOR_LOG_PATH;
  appendJson(logPath, { event: event.type, ...event });
  if (!jsonPath) return;
  const state = readJson(jsonPath) ?? {};
  const worker = typeof event.runId === "string" ? event : undefined;
  if (worker?.type === "worker_started" || worker?.type === "worker_terminal") {
    const workers = Array.isArray(state.workers) ? state.workers : [];
    const next = [...workers.filter((item: any) => item.runId !== worker.runId), {
      runId: worker.runId,
      agent: worker.agent,
      status: worker.type === "worker_started" ? "running" : ((worker.success === true) ? "completed" : "failed"),
      success: worker.type === "worker_terminal" ? worker.success : undefined,
      model: worker.model,
      durationMs: worker.durationMs,
      errorKind: worker.errorKind,
      updatedAt: new Date().toISOString(),
    }];
    writeJson(jsonPath, { ...state, workers: next, updatedAt: new Date().toISOString() });
    return;
  }
  writeJson(jsonPath, { ...state, updatedAt: new Date().toISOString() });
}

function record(event: Record<string, unknown>) {
  appendJson(process.env.BIFROST_PATTERN_EVENT_PATH, event);
  updateMonitor(event);
}

function errorKind(error: unknown) {
  const text = String(error ?? "").toLowerCase();
  if (text.includes("timed out")) return "timeout";
  if (text.includes("rate limit")) return "provider_rate_limit";
  if (text.includes("auth")) return "provider_auth";
  return text ? "worker_error" : undefined;
}

function directWorkerKind(agent: string | undefined) {
  try {
    const plan = JSON.parse(process.env.BIFROST_PATTERN_CAPABILITY_PLAN ?? "{}");
    return plan.directWorkers?.[agent ?? ""];
  } catch {
    return undefined;
  }
}

export default function (pi: ExtensionAPI) {
  pi.events.on("subagent:async-started", (data: Record<string, unknown>) => {
    record({ type: "worker_started", runId: data.id ?? data.runId, agent: data.agent, state: data.state, model: data.model });
  });

  pi.events.on("subagent:async-complete", (data: Record<string, unknown>) => {
    record({
      type: "worker_terminal",
      runId: data.id ?? data.runId,
      agent: data.agent,
      state: data.state,
      success: data.success === true,
      durationMs: data.durationMs,
      errorKind: errorKind(data.error),
      model: data.model,
    });
  });

  pi.on("tool_call", (event) => {
    if (event.toolName !== "subagent") return;
    const project = process.env.BIFROST_PATTERN_PROJECT;
    if (!project) return { block: true, reason: "Patterns target project is unavailable." };
    const agent = typeof event.input.agent === "string" ? event.input.agent : undefined;
    const directKind = directWorkerKind(agent);
    event.input.artifacts = false;
    if (!directKind) event.input.cwd = project;
    if (agent) {
      if (!directKind) {
        const guard = `${process.env.BIFROST_PATTERN_ROOT}/extensions/worker-guard.ts`;
        const extensions = Array.isArray(event.input.subagentOnlyExtensions) ? event.input.subagentOnlyExtensions : [];
        event.input.subagentOnlyExtensions = [...extensions, guard];
      }
      record({ type: "worker_requested", agent });
      return;
    }
    record({ type: "subagent_activity", action: event.input.action ?? "run" });
  });
}
