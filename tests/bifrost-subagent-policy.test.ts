import assert from "node:assert/strict";
import test from "node:test";
import policy from "../extensions/bifrost-subagent-policy.ts";

test("pins subagents to target project and disables artifacts", () => {
  let handler: ((event: { toolName: string; input: Record<string, unknown> }) => unknown) | undefined;
  policy({ on: (_name: string, callback: typeof handler) => { handler = callback; }, events: { on: () => () => {} } } as never);
  const prior = process.env.BIFROST_PATTERN_PROJECT;
  process.env.BIFROST_PATTERN_PROJECT = "/tmp/target";
  const input: Record<string, unknown> = { artifacts: true, cwd: "/wrong" };
  handler?.({ toolName: "subagent", input });
  assert.equal(input.artifacts, false);
  assert.equal(input.cwd, "/tmp/target");
  if (prior === undefined) delete process.env.BIFROST_PATTERN_PROJECT;
  else process.env.BIFROST_PATTERN_PROJECT = prior;
});

test("leaves selected direct worker CWD to its evaluator policy", () => {
  let handler: ((event: { toolName: string; input: Record<string, unknown> }) => unknown) | undefined;
  policy({ on: (_name: string, callback: typeof handler) => { handler = callback; }, events: { on: () => () => {} } } as never);
  const project = process.env.BIFROST_PATTERN_PROJECT;
  const plan = process.env.BIFROST_PATTERN_CAPABILITY_PLAN;
  process.env.BIFROST_PATTERN_PROJECT = "/tmp/target";
  process.env.BIFROST_PATTERN_CAPABILITY_PLAN = JSON.stringify({ directWorkers: { "bifrost-model-evaluator": "answer-evaluator" } });
  const input: Record<string, unknown> = { agent: "bifrost-model-evaluator", artifacts: true, cwd: "/outer" };
  handler?.({ toolName: "subagent", input });
  assert.equal(input.cwd, "/outer");
  assert.equal(input.artifacts, false);
  if (project === undefined) delete process.env.BIFROST_PATTERN_PROJECT;
  else process.env.BIFROST_PATTERN_PROJECT = project;
  if (plan === undefined) delete process.env.BIFROST_PATTERN_CAPABILITY_PLAN;
  else process.env.BIFROST_PATTERN_CAPABILITY_PLAN = plan;
});

test("does not change other tools", () => {
  let handler: ((event: { toolName: string; input: Record<string, unknown> }) => unknown) | undefined;
  policy({ on: (_name: string, callback: typeof handler) => { handler = callback; }, events: { on: () => () => {} } } as never);
  const input: Record<string, unknown> = { path: "x" };
  handler?.({ toolName: "read", input });
  assert.deepEqual(input, { path: "x" });
});
