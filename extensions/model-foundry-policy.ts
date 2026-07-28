import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", event => {
    if (event.toolName !== "subagent" || event.input?.agent !== "bifrost-model-evaluator") return;
    if (!event.input.model) return { block: true, reason: "Model Foundry evaluators require explicit candidate model." };
    const outerDirectory = process.env.BIFROST_PATTERN_OUTER_DIRECTORY;
    if (!outerDirectory) return { block: true, reason: "Model Foundry evaluation workspace is unavailable." };
    event.input.cwd = outerDirectory;
    event.input.artifacts = false;
  });
}
