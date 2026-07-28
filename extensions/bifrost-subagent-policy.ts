import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function record(event: Record<string, unknown>) {
  const path = process.env.BIFROST_PATTERN_EVENT_PATH;
  if (!path) return;
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (event.toolName !== "subagent") return;
    const project = process.env.BIFROST_PATTERN_PROJECT;
    if (!project) return { block: true, reason: "Patterns target project is unavailable." };
    event.input.cwd = project;
    event.input.artifacts = false;
    record({ type: "worker_requested", agent: String(event.input.agent ?? "unknown") });
  });
}
