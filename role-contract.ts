const NAME = /^[a-z][a-z0-9-]{1,48}$/;
const READ_TOOLS = ["read", "grep", "find", "ls", "bash"];
const WRITE_TOOLS = [...READ_TOOLS, "write", "edit"];

export type RoleSpec = {
  name: string;
  description: string;
  objective: string;
  deliverable: string;
  evidence: string;
  mode: "read-only" | "write";
  tools?: string[];
};

export function compileRole(spec: RoleSpec) {
  if (!NAME.test(spec.name)) throw new Error("Role name must be lowercase kebab-case.");
  for (const [field, value] of Object.entries(spec)) {
    if (field !== "tools" && (typeof value !== "string" || !value.trim())) throw new Error(`Role ${field} is required.`);
  }
  const allowed = spec.mode === "write" ? WRITE_TOOLS : READ_TOOLS;
  const tools = spec.tools ?? allowed;
  if (tools.some(tool => !allowed.includes(tool))) throw new Error(`Role tools must be limited to: ${allowed.join(", ")}.`);
  const acceptanceRole = spec.mode === "write" ? "writer" : "read-only";
  return `---
name: ${spec.name}
description: ${JSON.stringify(spec.description)}
tools: ${tools.join(",")}
inheritProjectContext: true
async: true
acceptanceRole: ${acceptanceRole}
---

You are generated for one bounded assignment.

Objective: ${spec.objective}

Deliverable: ${spec.deliverable}

Evidence required: ${spec.evidence}

Do not broaden scope. Stop after delivering required evidence. ${spec.mode === "read-only" ? "Do not modify project files." : "Do not commit, merge, or run mutating Git commands."}
`;
}
