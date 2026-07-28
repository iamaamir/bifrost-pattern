import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRecipe } from "./recipe-resolver.mjs";

const [recipe, project] = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectPath = project ? resolve(project) : undefined;
if (!recipe || !projectPath || !existsSync(projectPath)) {
  console.error("Usage: npm run run:new -- <recipe-id> <absolute-project-path>");
  process.exit(1);
}

const resolvedRecipe = resolveRecipe({ root, project: projectPath, id: recipe });
const id = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${basename(projectPath)}`;
const runDirectory = join(projectPath, ".pi", "bifrost-patterns", "manual-runs", id);
mkdirSync(runDirectory, { recursive: true });

const feedback = {
  recipe,
  startedAt: new Date().toISOString(),
  projectPath,
  steps: (resolvedRecipe.manifest.roles ?? []).map(role => ({
    role: role.id,
    routingIntent: role.routingIntent ?? "dynamic",
    result: "not_run",
    humanVerdict: "not_observed",
    notes: "",
  })),
  learning: "",
};

writeFileSync(join(runDirectory, "feedback.json"), `${JSON.stringify(feedback, null, 2)}\n`);
writeFileSync(join(runDirectory, "README.md"), `# ${recipe} run\n\n1. Follow recipe acceptance criteria.\n2. Record only observed model/decision metadata in feedback.json.\n3. Do not store prompt bodies, credentials, provider responses, file contents, or tool output.\n`);
console.log(`Created ${runDirectory}`);
