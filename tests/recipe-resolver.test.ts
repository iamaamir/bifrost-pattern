import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveRecipe, validateRecipe } from "../scripts/recipe-resolver.mjs";

function recipe(directory: string, id: string) {
  mkdirSync(join(directory, "prompts"), { recursive: true });
  writeFileSync(join(directory, "prompts", "outer.md"), "Outer prompt");
  writeFileSync(join(directory, "recipe.json"), JSON.stringify({
    id,
    version: 1,
    runtime: "pi",
    outer: { prompt: "prompts/outer.md" },
    safety: { automaticPromptReplay: false },
  }));
}

test("rejects unselected capability kinds", () => {
  const directory = mkdtempSync(join(tmpdir(), "bifrost-capabilities-"));
  mkdirSync(join(directory, "prompts"));
  writeFileSync(join(directory, "prompts", "outer.md"), "Outer prompt");
  const errors = validateRecipe({
    id: "example",
    version: 1,
    runtime: "pi",
    outer: { prompt: "prompts/outer.md" },
    safety: { automaticPromptReplay: false },
    capabilities: { outer: "unlimited" },
  }, directory);
  assert.deepEqual(errors, ["capabilities.outer must be a selected capability kind"]);
  rmSync(directory, { recursive: true, force: true });
});

test("rejects malformed capability kinds without crashing", () => {
  const directory = mkdtempSync(join(tmpdir(), "bifrost-capabilities-"));
  mkdirSync(join(directory, "prompts"));
  writeFileSync(join(directory, "prompts", "outer.md"), "Outer prompt");
  const errors = validateRecipe({
    id: "example",
    version: 1,
    runtime: "pi",
    outer: { prompt: "prompts/outer.md" },
    safety: { automaticPromptReplay: false },
    capabilities: { outer: {} },
  }, directory);
  assert.deepEqual(errors, ["capabilities.outer must be a selected capability kind"]);
  rmSync(directory, { recursive: true, force: true });
});

test("rejects direct workers outside selected Foundry capabilities", () => {
  const directory = mkdtempSync(join(tmpdir(), "bifrost-capabilities-"));
  mkdirSync(join(directory, "prompts"));
  writeFileSync(join(directory, "prompts", "outer.md"), "Outer prompt");
  const errors = validateRecipe({
    id: "example",
    version: 1,
    runtime: "pi",
    outer: { prompt: "prompts/outer.md" },
    safety: { automaticPromptReplay: false },
    capabilities: { directWorkers: { evaluator: "answer-evaluator" } },
  }, directory);
  assert.deepEqual(errors, ["direct-worker capability kinds require capabilities.outer: foundry"]);
  rmSync(directory, { recursive: true, force: true });
});

test("resolves bundled recipes before project recipes", () => {
  const root = mkdtempSync(join(tmpdir(), "bifrost-recipes-"));
  const project = join(root, "project");
  recipe(join(root, "recipes", "example"), "example");
  recipe(join(project, ".pi", "bifrost-patterns", "recipes", "example"), "example");
  assert.equal(resolveRecipe({ root, project, id: "example" }).source, "bundled");
  rmSync(root, { recursive: true, force: true });
});

test("resolves project-local recipes", () => {
  const root = mkdtempSync(join(tmpdir(), "bifrost-recipes-"));
  const project = join(root, "project");
  recipe(join(project, ".pi", "bifrost-patterns", "recipes", "project-only"), "project-only");
  const resolved = resolveRecipe({ root, project, id: "project-only" });
  assert.equal(resolved.source, "project");
  assert.match(resolved.promptPath, /prompts\/outer\.md$/);
  rmSync(root, { recursive: true, force: true });
});
