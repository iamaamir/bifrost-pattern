import assert from "node:assert/strict";
import test from "node:test";
import { compileRole } from "../role-contract.ts";

const role = {
  name: "staff-architect",
  description: "Designs bounded system architecture",
  objective: "Compare two service boundaries",
  deliverable: "ADR with tradeoffs",
  evidence: "Cite repository constraints",
  mode: "read-only" as const,
};

test("compiles bounded read-only generated role", () => {
  const output = compileRole(role);
  assert.match(output, /name: staff-architect/);
  assert.match(output, /acceptanceRole: read-only/);
  assert.match(output, /Do not modify project files/);
});

test("rejects unsafe role names and tool sets", () => {
  assert.throws(() => compileRole({ ...role, name: "Staff Architect" }));
  assert.throws(() => compileRole({ ...role, tools: ["write"] }));
});
