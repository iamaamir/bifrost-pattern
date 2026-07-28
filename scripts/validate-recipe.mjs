import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const recipesRoot = join(process.cwd(), "recipes");
const requiredRoleKeys = ["id", "owns", "routingIntent", "bifrostMode"];
let invalid = false;

for (const entry of readdirSync(recipesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(recipesRoot, entry.name);
  const manifestPath = join(directory, "recipe.json");
  const readmePath = join(directory, "README.md");

  if (!existsSync(manifestPath) || !existsSync(readmePath)) {
    console.error(`${entry.name}: missing recipe.json or README.md`);
    invalid = true;
    continue;
  }

  const recipe = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (recipe.id !== entry.name || !Array.isArray(recipe.roles) || recipe.roles.length === 0) {
    console.error(`${entry.name}: invalid id or roles`);
    invalid = true;
    continue;
  }

  for (const role of recipe.roles) {
    const missing = requiredRoleKeys.filter(key => !(key in role));
    if (missing.length) {
      console.error(`${entry.name}/${role.id ?? "unknown"}: missing ${missing.join(", ")}`);
      invalid = true;
    }
  }

  if (recipe.safety?.automaticPromptReplay !== false) {
    console.error(`${entry.name}: recipes must explicitly forbid automatic prompt replay`);
    invalid = true;
  }

  console.log(`${entry.name}: valid`);
}

if (invalid) process.exit(1);
