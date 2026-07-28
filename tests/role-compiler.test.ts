import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import compiler from "../extensions/role-compiler.ts";
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

test("creates reusable role in target project agent directory", async () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-role-"));
  const prior = process.env.BIFROST_PATTERN_PROJECT;
  process.env.BIFROST_PATTERN_PROJECT = project;
  let tool: any;
  compiler({ registerTool: (candidate: unknown) => { tool = candidate; } } as never);
  const result = await tool.execute("test", role, new AbortController().signal, () => {}, {});
  const path = join(project, ".pi", "bifrost-patterns", "agents", "staff-architect.md");
  assert.equal(result.isError, undefined);
  assert.equal(existsSync(path), true);
  assert.match(readFileSync(path, "utf8"), /ADR with tradeoffs/);
  rmSync(project, { recursive: true, force: true });
  if (prior === undefined) delete process.env.BIFROST_PATTERN_PROJECT;
  else process.env.BIFROST_PATTERN_PROJECT = prior;
});
