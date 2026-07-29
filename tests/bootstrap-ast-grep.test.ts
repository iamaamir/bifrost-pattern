import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureAstGrep, locateAstGrep, prepareAstGrep } from "../scripts/bootstrap-ast-grep.mjs";

test("uses local ast-grep before global alias", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  const local = join(project, ".pi", "bifrost-patterns", "tools", "ast-grep", "node_modules", ".bin", process.platform === "win32" ? "ast-grep.cmd" : "ast-grep");
  const run = (command: string) => command === local ? { status: 0, stdout: "ast-grep 0.45.0" } : command === "sg" ? { status: 0, stdout: "ast-grep 0.45.0" } : { status: 1 };
  assert.deepEqual(locateAstGrep({ project, run }), { status: "available", command: local, version: "ast-grep 0.45.0" });
  rmSync(project, { recursive: true, force: true });
});

test("does not install ast-grep without consent", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  let npmCalls = 0;
  const run = (command: string) => { if (command === "npm") npmCalls++; return { status: 1 }; };
  assert.equal(ensureAstGrep({ project, approved: false, run }).status, "unavailable");
  assert.equal(npmCalls, 0);
  rmSync(project, { recursive: true, force: true });
});

test("installs pinned local ast-grep after consent", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  let installed = false;
  const run = (command: string) => {
    if (command === "npm") { installed = true; return { status: 0 }; }
    if (installed && command.includes("node_modules")) return { status: 0, stdout: "ast-grep 0.45.0" };
    return { status: 1 };
  };
  const result = ensureAstGrep({ project, approved: true, run });
  assert.equal(result.status, "installed");
  assert.match(result.command!, /\.pi\/bifrost-patterns\/tools\/ast-grep\/node_modules\/\.bin\/ast-grep/);
  rmSync(project, { recursive: true, force: true });
});

test("reports reason when ast-grep install does not yield runnable binary", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  const run = (command: string) => command === "npm" ? { status: 0 } : { status: 1 };
  const result = ensureAstGrep({ project, approved: true, run });
  assert.equal(result.status, "failed");
  assert.match(result.reason ?? "", /binary unavailable after install/);
  rmSync(project, { recursive: true, force: true });
});

test("asks before installing ast-grep and respects decline", async () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  let asked = false;
  const run = (command: string) => command === "npm" ? { status: 0 } : { status: 1 };
  const result = await prepareAstGrep({ project, approved: false, run, ask: async () => { asked = true; return "n"; } });
  assert.equal(result.status, "unavailable");
  assert.equal(asked, true);
  rmSync(project, { recursive: true, force: true });
});

test("falls back after failed ast-grep install when user chooses continue", async () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  const run = (command: string) => command === "npm" ? { status: 0 } : { status: 1 };
  const answers = ["y", "2"];
  const result = await prepareAstGrep({ project, approved: false, run, ask: async () => answers.shift() ?? "2" });
  assert.equal(result.status, "fallback");
  assert.match(result.reason ?? "", /binary unavailable after install/);
  rmSync(project, { recursive: true, force: true });
});
