import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { hasConfiguredBifrost } from "../scripts/bootstrap-bifrost.mjs";

test("requires both Bifrost package scope and project config", () => {
  const root = mkdtempSync(join(tmpdir(), "bifrost-configured-"));
  const project = join(root, "project");
  const agent = join(root, "agent");
  mkdirSync(join(project, ".pi"), { recursive: true });
  mkdirSync(agent, { recursive: true });
  writeFileSync(join(project, ".pi", "bifrost.json"), "{}");
  writeFileSync(join(agent, "settings.json"), JSON.stringify({ packages: ["npm:pi-bifrost"] }));
  assert.equal(hasConfiguredBifrost(project, agent), true);
  rmSync(join(project, ".pi", "bifrost.json"));
  assert.equal(hasConfiguredBifrost(project, agent), false);
  rmSync(root, { recursive: true, force: true });
});
