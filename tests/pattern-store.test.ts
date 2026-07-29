import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
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

test("rejects unsafe artifact identifiers and cleans Foundry artifacts through store", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-store-"));
  const store = createPatternStore(project);
  assert.throws(() => store.runs.directory("../escape"), /safe artifact identifier/);
  assert.throws(() => store.recipes.directory(".."), /safe artifact identifier/);

  const run = store.runs.create("run-1");
  const workspace = store.runs.createFoundryWorkspace("run-1", "candidate");
  writeFileSync(join(workspace, "evidence.txt"), "evidence");
  writeFileSync(store.runs.foundryCompletionPath("run-1"), "{}", { encoding: "utf8" });
  store.runs.cleanupFoundry("run-1");

  assert.equal(existsSync(join(workspace, "evidence.txt")), false);
  assert.equal(existsSync(store.runs.foundryCompletionPath("run-1")), true);
  assert.deepEqual(readdirSync(run).sort(), [".model-foundry-complete.json"]);
});
