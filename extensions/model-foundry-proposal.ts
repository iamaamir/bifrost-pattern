import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildConfigFragment } from "../scripts/bifrost-config-fragment.mjs";

const proposalTool = defineTool({
  name: "bifrost_build_config_fragment",
  label: "Build Bifrost Config Fragment",
  description: "Build validated additive Bifrost config fragment from evaluated configured models. Does not write configuration.",
  parameters: Type.Object({
    tier: Type.String({ description: "Letters-only named Bifrost tier" }),
    models: Type.Array(Type.String({ description: "Evaluated configured provider/model" })),
    pattern: Type.String({ description: "JavaScript regex for appending one routing rule" }),
    strategy: Type.Optional(Type.String({ description: "Bifrost strategy; defaults to first" })),
  }),
  async execute(_id, input) {
    try {
      const project = process.env.BIFROST_PATTERN_PROJECT;
      if (!project) throw new Error("Target project is unavailable.");
      const config = JSON.parse(readFileSync(join(project, ".pi", "bifrost.json"), "utf8"));
      const configuredModels = new Set(Object.values(config.models ?? {}).flatMap(value => Array.isArray(value) ? value : [value]));
      const fragment = buildConfigFragment({ configuredModels, ...input });
      return { content: [{ type: "text", text: `Validated additive fragment. Merge models/categoryStrategies by key; append rules entry (do not replace existing rules).\n\n\`\`\`json\n${JSON.stringify(fragment, null, 2)}\n\`\`\`` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Config fragment blocked: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(proposalTool);
}
