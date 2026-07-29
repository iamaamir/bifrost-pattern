import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { loadOrchestratorProfile, saveOrchestratorModel } from "../scripts/orchestrator-profile.mjs";

test("stores orchestrator profiles in Pi project state", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-profile-"));

  assert.deepEqual(loadOrchestratorProfile(project), {});
  const path = saveOrchestratorModel({ project, recipe: "fixed-orchestrator-workers", model: "provider/model" });

  assert.equal(path, join(project, ".pi", "bifrost-patterns.json"));
  assert.equal(existsSync(path), true);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
    patterns: { "fixed-orchestrator-workers": { orchestratorModel: "provider/model" } }
  });
  assert.equal(existsSync(join(project, ".bifrost-patterns.json")), false);
});
