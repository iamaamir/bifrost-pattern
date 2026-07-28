import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listBundledRecipes } from "./recipe-resolver.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let invalid = false;
for (const recipe of listBundledRecipes(root)) {
  try {
    console.log(`${recipe.id}: valid`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    invalid = true;
  }
}
if (invalid) process.exit(1);
