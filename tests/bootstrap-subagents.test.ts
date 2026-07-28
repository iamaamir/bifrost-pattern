import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { subagentScopes } from "../scripts/bootstrap-subagents.mjs";

function settings(directory: string, packages: string[]) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "settings.json"), JSON.stringify({ packages }));
}

test("detects Pi-subagents scope without reading unrelated packages", () => {
  const root = mkdtempSync(join(tmpdir(), "bifrost-subagents-"));
  const user = join(root, "user");
  const project = join(root, "project");
  settings(user, ["npm:pi-subagents", "npm:other"]);
  settings(join(project, ".pi"), ["npm:pi-bifrost"]);
  assert.deepEqual(subagentScopes(project, user), { user: ["npm:pi-subagents"], local: [] });
  rmSync(root, { recursive: true, force: true });
});
