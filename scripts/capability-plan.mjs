const standardOuterTools = ["read", "grep", "find", "ls", "write", "edit", "bash", "bifrost_create_role", "subagent", "subagent_wait"];
const foundryOuterTools = [...standardOuterTools, "bifrost_build_config_fragment", "bifrost_create_evaluation_workspace", "bifrost_complete_model_foundry"];

const outerKinds = {
  standard: { tools: standardOuterTools, extensions: ["bifrost-subagent-policy", "role-compiler"] },
  foundry: { tools: foundryOuterTools, extensions: ["bifrost-subagent-policy", "role-compiler", "model-foundry-policy", "model-foundry-workspace", "model-foundry-proposal", "model-foundry-cleanup"] },
};

const directWorkerKinds = new Set(["answer-evaluator", "artifact-evaluator"]);

export function capabilityErrors(manifest) {
  const capabilities = manifest.capabilities;
  if (capabilities === undefined) {
    return manifest.directWorkers === undefined ? [] : ["directWorkers is replaced by capabilities.directWorkers"];
  }
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) return ["capabilities must be an object"];
  const errors = [];
  const outer = capabilities.outer ?? "standard";
  if (!(outer in outerKinds)) errors.push("capabilities.outer must be a selected capability kind");
  const workers = capabilities.directWorkers ?? {};
  if (!workers || typeof workers !== "object" || Array.isArray(workers)) errors.push("capabilities.directWorkers must map worker names to selected capability kinds");
  else for (const [agent, kind] of Object.entries(workers)) {
    if (!agent || typeof kind !== "string" || !directWorkerKinds.has(kind)) errors.push(`capabilities.directWorkers.${agent} must be a selected direct-worker capability kind`);
    if (outer !== "foundry") errors.push("direct-worker capability kinds require capabilities.outer: foundry");
  }
  if (manifest.directWorkers !== undefined) errors.push("directWorkers is replaced by capabilities.directWorkers");
  return [...new Set(errors)];
}

export function selectOuterTools(plan, requested) {
  if (requested === undefined) return plan.outer.tools;
  const tools = requested.split(",").map(tool => tool.trim()).filter(Boolean);
  const disallowed = tools.filter(tool => !plan.outer.tools.includes(tool));
  if (disallowed.length) throw new Error(`Outer tool not allowed by selected capabilities: ${disallowed.join(", ")}`);
  return tools;
}

export function resolveCapabilityPlan(manifest) {
  const errors = capabilityErrors(manifest);
  if (errors.length) throw new Error(`Invalid capability plan: ${errors.join("; ")}`);
  const capabilities = manifest.capabilities ?? {};
  const outerKind = capabilities.outer ?? "standard";
  return {
    outer: { kind: outerKind, ...outerKinds[outerKind] },
    directWorkers: capabilities.directWorkers ?? {},
  };
}
