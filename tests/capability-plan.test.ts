import assert from "node:assert/strict";
import test from "node:test";
import { resolveCapabilityPlan, selectOuterTools } from "../scripts/capability-plan.mjs";

const base = { id: "example", version: 1, runtime: "pi", safety: { automaticPromptReplay: false } };

test("gives standard recipes only standard outer capabilities", () => {
  const plan = resolveCapabilityPlan(base);
  assert.deepEqual(plan.outer.extensions, ["bifrost-subagent-policy", "role-compiler"]);
  assert.equal(plan.outer.tools.includes("bifrost_build_config_fragment"), false);
});

test("rejects an outer tool outside selected capabilities", () => {
  assert.throws(() => selectOuterTools(resolveCapabilityPlan(base), "read,bifrost_build_config_fragment"), /not allowed/);
});

test("gives selected Foundry kinds isolated evaluation capabilities", () => {
  const plan = resolveCapabilityPlan({
    ...base,
    capabilities: {
      outer: "foundry",
      directWorkers: {
        "bifrost-model-evaluator": "answer-evaluator",
        "bifrost-model-artifact-evaluator": "artifact-evaluator",
      },
    },
  });
  assert.equal(plan.outer.tools.includes("bifrost_build_config_fragment"), true);
  assert.equal(plan.directWorkers["bifrost-model-artifact-evaluator"], "artifact-evaluator");
});
