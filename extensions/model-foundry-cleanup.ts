import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPatternStore } from "../scripts/pattern-store.mjs";

const completionPath = () => join(process.env.BIFROST_PATTERN_RUN_DIRECTORY ?? ".", ".model-foundry-complete.json");

const completeTool = defineTool({
  name: "bifrost_complete_model_foundry",
  label: "Complete Model Foundry",
  description: "Mark Model Foundry terminal outcome and remove detailed run artifacts after final response settles.",
  parameters: Type.Object({
    outcome: Type.Union([Type.Literal("proposal"), Type.Literal("insufficient-evidence"), Type.Literal("declined")]),
  }),
  async execute(_id, input) {
    try {
      const runDirectory = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
      if (!runDirectory) throw new Error("Model Foundry run directory is unavailable.");
      mkdirSync(runDirectory, { recursive: true });
      writeFileSync(completionPath(), `${JSON.stringify({ outcome: input.outcome, completedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
      return { content: [{ type: "text", text: "Foundry completion recorded. Detailed artifacts delete after this response." }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Foundry completion blocked: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(completeTool);
  pi.on("agent_settled", () => {
    const runDirectory = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
    if (!runDirectory || !existsSync(completionPath())) return;
    const project = process.env.BIFROST_PATTERN_PROJECT;
    if (!project) return;
    createPatternStore(project).runs.cleanupFoundry(basename(runDirectory));
  });
}
