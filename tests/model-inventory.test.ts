import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildModelInventory } from "../scripts/model-inventory.mjs";

test("flattens configured Bifrost models without changing config", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-models-"));
  mkdirSync(join(project, ".pi"));
  writeFileSync(join(project, ".pi", "bifrost.json"), JSON.stringify({ models: { quick: ["provider/fast", "provider/shared"], frontier: "provider/shared" } }));
  assert.deepEqual(buildModelInventory(project), {
    tiers: [{ tier: "quick", models: ["provider/fast", "provider/shared"] }, { tier: "frontier", models: ["provider/shared"] }],
    candidates: [{ model: "provider/fast", tiers: ["quick"] }, { model: "provider/shared", tiers: ["quick", "frontier"] }],
  });
  rmSync(project, { recursive: true, force: true });
});
