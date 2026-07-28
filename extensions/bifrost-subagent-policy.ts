import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (event.toolName !== "subagent") return;
    const project = process.env.BIFROST_PATTERN_PROJECT;
    if (!project) return { block: true, reason: "Patterns target project is unavailable." };
    event.input.cwd = project;
    event.input.artifacts = false;
  });
}
