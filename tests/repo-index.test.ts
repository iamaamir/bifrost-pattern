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
  const run = (_command: string, args: string[]) => {
    if (_command !== "git") return { status: 0, stdout: "ast-grep 0.45.0" };
    if (args[0] === "rev-parse") return { status: 0, stdout: "abcdef1234567890abcdef1234567890abcdef12" };
    if (args[0] === "branch") return { status: 0, stdout: "main" };
    if (args[0] === "status") return { status: 0, stdout: "" };
    return { status: 0, stdout: "" };
  };
  const index = buildRepoIndex({ project, cachePath: join(project, ".cache.json"), run });
  assert.equal(index.summary.files, 4);
  assert.equal(index.manifests.package.name, "example");
  assert.deepEqual(index.manifests.package.scripts, { test: "node --test" });
  assert.equal(index.git.sha, "abcdef1234567890abcdef1234567890abcdef12");
  assert.equal(index.git.branch, "main");
  assert.equal(index.git.dirty, false);
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
    : { status: 0, stdout: JSON.stringify([
      {
        path: "src/index.ts",
        language: "TypeScript",
        items: [{ name: "serve", symbolType: "function", range: { start: { line: 0 } }, text: "export function serve() {}" }],
      },
      {
        path: "src/server.ts",
        language: "TypeScript",
        items: [{ name: "server", symbolType: "function", range: { start: { line: 1 } }, text: "export function server() {}" }],
      },
    ]) };
  const index = buildRepoIndex({ project, cachePath: join(project, ".cache.json"), run });
  assert.equal(index.capabilities.astGrep.status, "available");
  assert.deepEqual(index.capabilities.astGrep.symbols, [
    { file: "src/index.ts", name: "serve", kind: "function", line: 0 },
    { file: "src/server.ts", name: "server", kind: "function", line: 1 },
  ]);
  assert.doesNotMatch(JSON.stringify(index.capabilities.astGrep), /export function serve/);
  rmSync(project, { recursive: true, force: true });
});

test("reuses index when file fingerprints and git head match", () => {
  const project = fixture();
  const cachePath = join(project, ".cache.json");
  const responses = [
    { revParse: "1111111111111111111111111111111111111111", branch: "main", status: "" },
    { revParse: "1111111111111111111111111111111111111111", branch: "main", status: "" },
    { revParse: "2222222222222222222222222222222222222222", branch: "main", status: "" },
  ];
  const run = (_command: string, args: string[]) => {
    if (_command !== "git") return { status: 0, stdout: "ast-grep 0.45.0" };
    const current = responses[0] ?? responses[responses.length - 1];
    if (args[0] === "rev-parse") return { status: 0, stdout: current.revParse };
    if (args[0] === "branch") return { status: 0, stdout: current.branch };
    if (args[0] === "status") {
      const taken = responses.shift() ?? current;
      return { status: 0, stdout: taken.status };
    }
    return { status: 0, stdout: "" };
  };
  assert.equal(buildRepoIndex({ project, cachePath, run }).cacheHit, false);
  assert.equal(buildRepoIndex({ project, cachePath, run }).cacheHit, true);
  assert.equal(buildRepoIndex({ project, cachePath, run }).cacheHit, false);
  rmSync(project, { recursive: true, force: true });
});
