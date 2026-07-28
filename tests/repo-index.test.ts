import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildRepoIndex } from "../scripts/repo-index.mjs";

function fixture() {
  const project = mkdtempSync(join(tmpdir(), "bifrost-index-"));
  mkdirSync(join(project, "src"), { recursive: true });
  mkdirSync(join(project, "test"), { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "example", scripts: { test: "node --test" }, dependencies: { express: "1.0.0" } }));
  writeFileSync(join(project, "src", "index.ts"), 'import { serve } from "./server.js";\nserve();\n');
  writeFileSync(join(project, "src", "server.ts"), "export function serve() {}\n");
  writeFileSync(join(project, "test", "server.test.ts"), "import { serve } from '../src/server.js';\n");
  return project;
}

test("builds compact local repository map without source contents", () => {
  const project = fixture();
  const index = buildRepoIndex({ project, cachePath: join(project, ".cache.json") });
  assert.equal(index.summary.files, 4);
  assert.equal(index.manifests.package.name, "example");
  assert.deepEqual(index.manifests.package.scripts, { test: "node --test" });
  assert.ok(index.entryCandidates.includes("src/index.ts"));
  assert.ok(index.testCandidates.includes("test/server.test.ts"));
  assert.ok(index.importEdges.some(edge => edge.from === "src/index.ts" && edge.to === "./server.js"));
  assert.doesNotMatch(JSON.stringify(index), /export function serve/);
  rmSync(project, { recursive: true, force: true });
});

test("uses installed ast-grep outline without storing source text", () => {
  const project = fixture();
  const run = (_command: string, args: string[]) => args[0] === "--version"
    ? { status: 0, stdout: "ast-grep 0.45.0" }
    : { status: 0, stdout: JSON.stringify({ items: [{ file: "src/index.ts", name: "serve", symbolType: "function", range: { start: { line: 0 } }, text: "export function serve() {}" }] }) };
  const index = buildRepoIndex({ project, cachePath: join(project, ".cache.json"), run });
  assert.equal(index.capabilities.astGrep.status, "available");
  assert.deepEqual(index.capabilities.astGrep.symbols, [{ file: "src/index.ts", name: "serve", kind: "function", line: 0 }]);
  assert.doesNotMatch(JSON.stringify(index.capabilities.astGrep), /export function serve/);
  rmSync(project, { recursive: true, force: true });
});

test("reuses index when file fingerprints match", () => {
  const project = fixture();
  const cachePath = join(project, ".cache.json");
  assert.equal(buildRepoIndex({ project, cachePath }).cacheHit, false);
  assert.equal(buildRepoIndex({ project, cachePath }).cacheHit, true);
  rmSync(project, { recursive: true, force: true });
});
