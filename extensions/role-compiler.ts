import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { compileRole } from "../role-contract.ts";
import { createPatternStore } from "../scripts/pattern-store.mjs";

function registerRoleDirectory(directory: string) {
  const current = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter).filter(Boolean) ?? [];
  if (!current.includes(directory)) process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [...current, directory].join(delimiter);
}

const roleCompiler = defineTool({
  name: "bifrost_create_role",
  label: "Create Bifrost Role",
  description: "Create a validated reusable worker role for current target project, then use its name with subagent.",
  parameters: Type.Object({
    name: Type.String({ description: "Lowercase kebab-case role name" }),
    description: Type.String({ description: "Compact capability description" }),
    objective: Type.String({ description: "Bounded worker objective" }),
    deliverable: Type.String({ description: "Required output" }),
    evidence: Type.String({ description: "Required validation evidence" }),
    mode: Type.Union([Type.Literal("read-only"), Type.Literal("write")]),
    tools: Type.Optional(Type.Array(Type.String())),
  }),
  async execute(_id, spec) {
    try {
      const project = process.env.BIFROST_PATTERN_PROJECT;
      if (!project) throw new Error("Patterns target project is unavailable.");
      const directory = createPatternStore(project).agents.directory();
      const path = join(directory, `${spec.name}.md`);
      if (existsSync(path)) throw new Error(`Role '${spec.name}' already exists. Tune ${path} directly.`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(path, compileRole(spec), { mode: 0o600 });
      registerRoleDirectory(directory);
      return { content: [{ type: "text", text: `Created role '${spec.name}'. Use subagent agent: '${spec.name}'.` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Role creation blocked: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(roleCompiler);
}
