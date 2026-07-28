import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureBifrost, hasConfiguredBifrost } from "../scripts/bootstrap-bifrost.mjs";

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

test("leaves valid Bifrost setup untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "bifrost-existing-"));
  const project = join(root, "project");
  const agent = join(root, "agent");
  mkdirSync(join(project, ".pi"), { recursive: true });
  mkdirSync(agent, { recursive: true });
  const config = '{"enabled":true}\n';
  writeFileSync(join(project, ".pi", "bifrost.json"), config);
  writeFileSync(join(agent, "settings.json"), JSON.stringify({ packages: ["npm:pi-bifrost"] }));
  assert.deepEqual(ensureBifrost({ project, agentDirectory: agent, approveProbe: true }), { needsProbeConsent: false, models: [] });
  assert.equal(readFileSync(join(project, ".pi", "bifrost.json"), "utf8"), config);
  rmSync(root, { recursive: true, force: true });
});
