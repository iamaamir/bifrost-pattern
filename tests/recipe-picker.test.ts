import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chooseRecipe, recipePickerRows } from "../scripts/recipe-picker.mjs";
import { listAvailableRecipes } from "../scripts/recipe-resolver.mjs";

function validRecipe(directory, id) {
  mkdirSync(join(directory, "prompts"), { recursive: true });
  writeFileSync(join(directory, "prompts", "orchestrator.md"), "outer prompt");
  writeFileSync(join(directory, "recipe.json"), JSON.stringify({ id, version: 1, runtime: "pi", outer: { prompt: "prompts/orchestrator.md" }, safety: { automaticPromptReplay: false } }));
}

test("lists bundled and project recipes for picker", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-recipes-"));
  const recipeDir = join(project, ".pi", "bifrost-patterns", "recipes", "project-only");
  validRecipe(recipeDir, "project-only");
  const available = listAvailableRecipes("/Users/mak/git/bifrost-patterns", project);
  assert.ok(available.some(recipe => recipe.id === "repo-onboarding"));
  assert.ok(available.some(recipe => recipe.id === "project-only"));
  assert.equal(recipePickerRows(available).includes("project-only"), true);
});

test("selects recipe via fzf when TTY available", async () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-recipes-"));
  const recipeDir = join(project, ".pi", "bifrost-patterns", "recipes", "project-only");
  validRecipe(recipeDir, "project-only");
  const selected = await chooseRecipe({
    root: "/Users/mak/git/bifrost-patterns",
    project,
    stdin: { isTTY: true },
    stdout: { isTTY: true },
    spawn: () => ({ status: 0, stdout: "project-only  project\n" }),
  });
  assert.equal(selected.id, "project-only");
});

test("falls back to numbered prompt when fzf unavailable", async () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-recipes-"));
  const recipeDir = join(project, ".pi", "bifrost-patterns", "recipes", "project-only");
  validRecipe(recipeDir, "project-only");
  const input = new PassThrough();
  const output = new PassThrough();
  let printed = "";
  output.on("data", chunk => printed += chunk.toString("utf8"));
  const selectedPromise = chooseRecipe({
    root: "/Users/mak/git/bifrost-patterns",
    project,
    stdin: input,
    stdout: output,
    spawn: () => ({ status: 1, stdout: "" }),
  });
  input.write("1\n");
  input.end();
  const selected = await selectedPromise;
  assert.equal(selected.id, listAvailableRecipes("/Users/mak/git/bifrost-patterns", project)[0].id);
  assert.match(printed, /Available recipes:/);
});
