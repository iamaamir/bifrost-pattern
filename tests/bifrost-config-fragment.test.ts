import assert from "node:assert/strict";
import test from "node:test";
import { buildConfigFragment } from "../scripts/bifrost-config-fragment.mjs";

const configuredModels = new Set(["opencode/big-pickle", "openai-codex/gpt-5.4"]);

test("builds canonical additive Bifrost tier fragment", () => {
  assert.deepEqual(buildConfigFragment({
    configuredModels,
    tier: "testing",
    models: ["opencode/big-pickle", "openai-codex/gpt-5.4"],
    pattern: "\\b(test|tests|coverage)\\b",
  }), {
    models: { testing: ["opencode/big-pickle", "openai-codex/gpt-5.4"] },
    categoryStrategies: { testing: "first" },
    rules: [{ pattern: "\\b(test|tests|coverage)\\b", model: "testing" }],
  });
});

test("rejects unconfigured models and unusable tier names", () => {
  assert.throws(() => buildConfigFragment({ configuredModels, tier: "test-pool", models: ["opencode/big-pickle"], pattern: "test" }));
  assert.throws(() => buildConfigFragment({ configuredModels, tier: "testing", models: ["other/model"], pattern: "test" }));
});
