import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureAstGrep, locateAstGrep } from "../scripts/bootstrap-ast-grep.mjs";

test("uses existing ast-grep before local install", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-ast-grep-"));
  const run = (command: string) => command === "sg" ? { status: 0, stdout: "ast-grep 0.45.0" } : { status: 1 };
  assert.deepEqual(locateAstGrep({ project, run }), { status: "available", command: "sg", version: "ast-grep 0.45.0" });
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
  assert.match(result.command!, /\.pi\/bifrost-patterns\/tools\/ast-grep\/node_modules/);
  rmSync(project, { recursive: true, force: true });
});
