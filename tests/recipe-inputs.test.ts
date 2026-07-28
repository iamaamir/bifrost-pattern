import assert from "node:assert/strict";
import test from "node:test";
import { resolveRecipeInputs, renderInitialMessage } from "../scripts/recipe-inputs.mjs";

const recipe = {
  inputs: [{
    id: "discoveryScope",
    prompt: "Discovery scope",
    options: [
      { value: "source-only", label: "Source only" },
      { value: "source-history-adrs", label: "Source, history, and ADRs" },
    ],
  }],
  outer: { initialMessage: "Start onboarding. Scope: {{discoveryScope}}." },
};

test("accepts declared recipe input and renders initial message", () => {
  const inputs = resolveRecipeInputs(recipe, ["discoveryScope=source-only"]);
  assert.deepEqual(inputs, { discoveryScope: "source-only" });
  assert.equal(renderInitialMessage(recipe, inputs), "Start onboarding. Scope: source-only.");
});

test("rejects missing and unknown recipe inputs", () => {
  assert.throws(() => resolveRecipeInputs(recipe, []), /requires input/);
  assert.throws(() => resolveRecipeInputs(recipe, ["unknown=value", "discoveryScope=source-only"]), /unknown input/);
});
