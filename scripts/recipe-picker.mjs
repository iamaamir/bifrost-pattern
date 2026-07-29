import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { listAvailableRecipes } from "./recipe-resolver.mjs";

export function recipePickerRows(recipes) {
  return recipes.map(recipe => recipe.id);
}

export async function chooseRecipe({ root, project, stdin = process.stdin, stdout = process.stdout, spawn = spawnSync }) {
  const recipes = listAvailableRecipes(root, project);
  if (!recipes.length) throw new Error("No recipes found for this project.");
  const rows = recipePickerRows(recipes);
  if (stdin.isTTY && stdout.isTTY) {
    const fzf = spawn("fzf", ["--height=60%", "--reverse", "--prompt=Recipe> "], {
      input: `${rows.join("\n")}\n`,
      encoding: "utf8",
    });
    if (fzf?.status === 0 && fzf.stdout) {
      const id = String(fzf.stdout).trim().split(/\s+/)[0];
      const selected = recipes.find(recipe => recipe.id === id);
      if (selected) return selected;
    }
  }
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    stdout.write(`Available recipes:\n${rows.map((row, index) => `${index + 1}) ${row}`).join("\n")}\n`);
    const answer = Number((await prompt.question("Choose recipe: ")).trim());
    const selected = recipes[answer - 1];
    if (!selected) throw new Error("No recipe selected.");
    return selected;
  } finally {
    prompt.close();
  }
}
