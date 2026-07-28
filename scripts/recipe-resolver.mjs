import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function validateRecipe(recipe, directory) {
  const errors = [];
  if (!recipe || typeof recipe !== "object") errors.push("manifest must be an object");
  if (!recipe?.id || typeof recipe.id !== "string") errors.push("id is required");
  if (!Number.isInteger(recipe?.version) || recipe.version < 1) errors.push("version must be a positive integer");
  if (recipe?.runtime !== "pi") errors.push("runtime must be 'pi'");
  if (recipe?.safety?.automaticPromptReplay !== false) errors.push("automaticPromptReplay must be false");
  const prompt = recipe?.outer?.prompt ?? recipe?.roles?.find(role => role.id === "orchestrator")?.prompt;
  if (!prompt || typeof prompt !== "string" || !existsSync(join(directory, prompt))) errors.push("outer prompt is missing");
  if (recipe?.inputs !== undefined && !Array.isArray(recipe.inputs)) errors.push("inputs must be an array");
  const ids = new Set();
  for (const input of recipe?.inputs ?? []) {
    if (!input.id || !input.prompt || !Array.isArray(input.options) || input.options.length === 0) errors.push("each input requires id, prompt, and options");
    if (ids.has(input.id)) errors.push(`input '${input.id}' is duplicated`);
    ids.add(input.id);
    if (!input.options?.every(option => typeof option.value === "string" && typeof option.label === "string")) errors.push(`input '${input.id}' has invalid options`);
    if (input.default !== undefined && !input.options?.some(option => option.value === input.default)) errors.push(`input '${input.id}' default is not an option`);
  }
  if (recipe?.preflight !== undefined && !Array.isArray(recipe.preflight)) errors.push("preflight must be an array");
  for (const step of recipe?.preflight ?? []) {
    if (step.capability !== "repo-index" || typeof step.output !== "string" || step.output.startsWith("/") || step.output.includes("..")) errors.push("preflight steps must use known capability and safe relative output");
  }
  return errors;
}

function load(directory, id) {
  const manifestPath = join(directory, "recipe.json");
  if (!existsSync(manifestPath)) return undefined;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = validateRecipe(manifest, directory);
  if (errors.length) throw new Error(`Invalid recipe '${id}': ${errors.join("; ")}`);
  if (manifest.id !== id) throw new Error(`Recipe directory '${id}' does not match manifest id '${manifest.id}'.`);
  return { id, directory, manifest, promptPath: join(directory, manifest.outer?.prompt ?? manifest.roles.find(role => role.id === "orchestrator").prompt) };
}

export function resolveRecipe({ root, project, id }) {
  const candidates = [
    { directory: join(root, "recipes", id), source: "bundled" },
    { directory: join(project, ".pi", "bifrost-patterns", "recipes", id), source: "project" },
  ];
  for (const candidate of candidates) {
    const resolved = load(candidate.directory, id);
    if (resolved) return { ...resolved, source: candidate.source };
  }
  throw new Error(`Recipe '${id}' was not found. Checked bundled and .pi/bifrost-patterns/recipes.`);
}

export function listBundledRecipes(root) {
  const recipesRoot = resolve(root, "recipes");
  if (!existsSync(recipesRoot)) return [];
  return readdirSync(recipesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => load(join(recipesRoot, entry.name), entry.name))
    .filter(Boolean);
}
