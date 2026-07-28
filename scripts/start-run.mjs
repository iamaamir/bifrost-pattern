import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [recipe, project] = process.argv.slice(2);
if (!recipe || !project) {
  console.error("Usage: npm run run:new -- <recipe-id> <absolute-project-path>");
  process.exit(1);
}

const manifest = join(process.cwd(), "recipes", recipe, "recipe.json");
const projectPath = resolve(project);
if (!existsSync(manifest) || !existsSync(projectPath)) {
  console.error("Recipe or project path does not exist.");
  process.exit(1);
}

const id = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${basename(projectPath)}`;
const runDirectory = join(process.cwd(), "runs", id);
mkdirSync(runDirectory, { recursive: true });

const feedback = {
  recipe,
  startedAt: new Date().toISOString(),
  projectPath,
  steps: [
    { role: "orchestrator", routingIntent: "none", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "scout", routingIntent: "quick", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "implementer", routingIntent: "general", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "verifier", routingIntent: "general", result: "not_run", humanVerdict: "not_observed", notes: "" }
  ],
  learning: ""
};

writeFileSync(join(runDirectory, "feedback.json"), `${JSON.stringify(feedback, null, 2)}\n`);
writeFileSync(join(runDirectory, "README.md"), `# ${recipe} run\n\n1. Pin or bypass Bifrost in outer orchestrator session using public controls.\n2. Verify a worker loads project Bifrost configuration.\n3. Run bounded role assignments.\n4. Record only observed model/decision metadata in feedback.json.\n5. Do not store prompt bodies, credentials, or provider responses.\n`);

console.log(`Created ${runDirectory}`);
console.log("Manual launch only: process inheritance/pinning must be proven before automation.");
