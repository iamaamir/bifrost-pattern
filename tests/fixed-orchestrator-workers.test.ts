import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = "/Users/mak/git/bifrost-patterns";
const recipePath = join(root, "recipes", "fixed-orchestrator-workers", "recipe.json");
const promptPath = join(root, "recipes", "fixed-orchestrator-workers", "prompts", "orchestrator.md");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("fixed orchestrator recipe seeds repo-index preflight", () => {
  const recipe = readJson(recipePath);
  assert.ok(Array.isArray(recipe.preflight));
  assert.ok(recipe.preflight.some((step: { capability: string; output: string }) => step.capability === "repo-index" && step.output === "fixed-orchestrator-workers/repo-index.json"));
  assert.match(recipe.requires.manualAssumptions.join(" "), /Repo-index is orientation only/);
  assert.ok(recipe.acceptance.some((line: string) => /graph-first bootstrap/i.test(line)));
});

test("fixed orchestrator prompt demands graph-first bootstrap and thin workers", () => {
  const prompt = readFileSync(promptPath, "utf8");
  assert.match(prompt, /graph-first bootstrap/i);
  assert.match(prompt, /repo-index/i);
  assert.match(prompt, /git sha/i);
  assert.match(prompt, /exact path and exact symbol/i);
  assert.match(prompt, /delta-only worker output/i);
  assert.match(prompt, /freshness warnings/i);
  assert.match(prompt, /token saving is a constraint, not a success condition/i);
});
