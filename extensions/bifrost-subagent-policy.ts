import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function record(event: Record<string, unknown>) {
  const path = process.env.BIFROST_PATTERN_EVENT_PATH;
  if (!path) return;
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function errorKind(error: unknown) {
  const text = String(error ?? "").toLowerCase();
  if (text.includes("timed out")) return "timeout";
  if (text.includes("rate limit")) return "provider_rate_limit";
  if (text.includes("auth")) return "provider_auth";
  return text ? "worker_error" : undefined;
}

export default function (pi: ExtensionAPI) {
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
    if (agent !== "bifrost-model-artifact-evaluator") event.input.cwd = project;
    event.input.artifacts = false;
    if (agent) {
      const guard = `${process.env.BIFROST_PATTERN_ROOT}/extensions/worker-guard.ts`;
      const extensions = Array.isArray(event.input.subagentOnlyExtensions) ? event.input.subagentOnlyExtensions : [];
      event.input.subagentOnlyExtensions = [...extensions, guard];
      record({ type: "worker_requested", agent });
      return;
    }
    record({ type: "subagent_activity", action: event.input.action ?? "run" });
  });
}
