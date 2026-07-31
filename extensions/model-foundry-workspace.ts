import { cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPatternStore } from "../scripts/pattern-store.mjs";

const workspaceTool = defineTool({
  name: "bifrost_create_evaluation_workspace",
  label: "Create Evaluation Workspace",
  description: "Create isolated disposable project copy for a Model Foundry artifact evaluation.",
  parameters: Type.Object({ name: Type.String({ description: "Lowercase short workspace name" }) }),
  async execute(_id, spec) {
    try {
      const project = process.env.BIFROST_PATTERN_PROJECT;
      const runDirectory = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
      if (!project || !runDirectory) throw new Error("Model Foundry workspace is unavailable.");
      if (!/^[a-z0-9-]{1,48}$/.test(spec.name)) throw new Error("Workspace name must be lowercase letters, digits, or hyphens.");
      const destination = createPatternStore(project).runs.foundryWorkspace(basename(runDirectory), `${spec.name}-${basename(project)}`);
      if (existsSync(destination)) throw new Error("Workspace already exists.");
      mkdirSync(destination, { recursive: true });
      cpSync(project, destination, { recursive: true, filter: path => ![".git", ".pi", "node_modules", "dist", "build", "coverage"].includes(basename(path)) });
      mkdirSync(join(destination, ".pi"), { recursive: true });
      return { content: [{ type: "text", text: `Created disposable evaluation workspace: ${destination}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Workspace creation blocked: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(workspaceTool);
}
