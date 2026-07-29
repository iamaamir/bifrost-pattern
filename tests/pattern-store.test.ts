import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPatternStore } from "../scripts/pattern-store.mjs";

test("centralizes Pattern state and cleans only scoped ephemeral run artifacts", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-store-"));
  const store = createPatternStore(project);
  assert.equal(store.profile.path, join(project, ".pi", "bifrost-patterns", "profile.json"));

  store.profile.saveModel("recipe", "provider/model");
  assert.equal(store.profile.read().patterns.recipe.orchestratorModel, "provider/model");

  const run = store.runs.create("run-1");
  writeFileSync(join(run, "temporary.txt"), "ephemeral");
  writeFileSync(join(store.ledger.directory(), "run-1.json"), "{}", { encoding: "utf8" });
  store.runs.cleanup("run-1");

  assert.equal(existsSync(run), false);
  assert.equal(existsSync(store.ledger.path("run-1")), true);
  assert.equal(existsSync(store.profile.path), true);
});
