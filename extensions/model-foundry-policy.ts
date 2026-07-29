import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function directWorkerKind(agent: unknown) {
  try {
    const plan = JSON.parse(process.env.BIFROST_PATTERN_CAPABILITY_PLAN ?? "{}");
    return plan.directWorkers?.[String(agent ?? "")];
  } catch {
    return undefined;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", event => {
    const kind = directWorkerKind(event.input?.agent);
    if (event.toolName !== "subagent" || !kind) return;
    if (!event.input.model) return { block: true, reason: "Model Foundry evaluators require explicit candidate model." };
    if (kind === "answer-evaluator") {
      const outerDirectory = process.env.BIFROST_PATTERN_OUTER_DIRECTORY;
      if (!outerDirectory) return { block: true, reason: "Model Foundry evaluation workspace is unavailable." };
      event.input.cwd = outerDirectory;
      event.input.artifacts = false;
      return;
    }
    if (kind !== "artifact-evaluator") return { block: true, reason: "Unknown Model Foundry evaluator capability." };
    const root = resolve(process.env.BIFROST_PATTERN_RUN_DIRECTORY ?? "", "model-foundry", "workspaces");
    const cwd = resolve(String(event.input.cwd ?? ""));
    if (!root || !cwd.startsWith(`${root}/`)) return { block: true, reason: "Artifact evaluators must use a disposable Model Foundry workspace." };
    event.input.artifacts = false;
    const extensions = Array.isArray(event.input.subagentOnlyExtensions) ? event.input.subagentOnlyExtensions : [];
    event.input.subagentOnlyExtensions = [...extensions, `${process.env.BIFROST_PATTERN_ROOT}/extensions/model-foundry-sandbox-guard.ts`];
  });
}
