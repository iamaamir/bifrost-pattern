import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const artifactAgent = "bifrost-model-artifact-evaluator";
const answerAgent = "bifrost-model-evaluator";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", event => {
    if (event.toolName !== "subagent" || ![answerAgent, artifactAgent].includes(String(event.input?.agent))) return;
    if (!event.input.model) return { block: true, reason: "Model Foundry evaluators require explicit candidate model." };
    if (event.input.agent === answerAgent) {
      const outerDirectory = process.env.BIFROST_PATTERN_OUTER_DIRECTORY;
      if (!outerDirectory) return { block: true, reason: "Model Foundry evaluation workspace is unavailable." };
      event.input.cwd = outerDirectory;
      event.input.artifacts = false;
      return;
    }
    const root = resolve(process.env.BIFROST_PATTERN_RUN_DIRECTORY ?? "", "model-foundry", "workspaces");
    const cwd = resolve(String(event.input.cwd ?? ""));
    if (!root || !cwd.startsWith(`${root}/`)) return { block: true, reason: "Artifact evaluators must use a disposable Model Foundry workspace." };
    event.input.artifacts = false;
    const extensions = Array.isArray(event.input.subagentOnlyExtensions) ? event.input.subagentOnlyExtensions : [];
    event.input.subagentOnlyExtensions = [...extensions, `${process.env.BIFROST_PATTERN_ROOT}/extensions/model-foundry-sandbox-guard.ts`];
  });
}
