import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";

const [recipe, projectArg, ...flags] = process.argv.slice(2);
const option = name => {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
};
const dryRun = flags.includes("--dry-run");

if (recipe !== "fixed-orchestrator-workers" || !projectArg) {
  console.error("Usage: npm run pattern:run -- fixed-orchestrator-workers <project-path> [--orchestrator-model provider/model] [--outer-tools tool,...] [--dry-run]");
  process.exit(1);
}

const root = process.cwd();
const project = resolve(projectArg);
const manifest = join(root, "recipes", recipe, "recipe.json");
if (!existsSync(project) || !existsSync(manifest)) {
  console.error("Project path or recipe does not exist.");
  process.exit(1);
}

const profilePath = join(project, ".bifrost-patterns.json");
const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : {};
let model = option("--orchestrator-model") ?? profile.patterns?.[recipe]?.orchestratorModel;

if (!model) {
  console.log("\nAvailable Pi models:\n");
  const listed = spawnSync("pi", ["--list-models"], { encoding: "utf8" });
  process.stdout.write(listed.stdout || "(Pi returned no available models. Check login/provider configuration.)\n");
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  model = (await prompt.question("\nChoose orchestrator provider/model: ")).trim();
  prompt.close();
  if (!model) {
    console.error("An explicit orchestrator model is required.");
    process.exit(1);
  }
  const next = {
    ...profile,
    patterns: {
      ...profile.patterns,
      [recipe]: { ...profile.patterns?.[recipe], orchestratorModel: model }
    }
  };
  writeFileSync(profilePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Saved orchestrator model in ${profilePath}`);
}

const id = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${basename(project)}`;
const runDirectory = join(root, "runs", id);
const outerDirectory = join(runDirectory, "outer");
mkdirSync(outerDirectory, { recursive: true });

writeFileSync(join(runDirectory, "feedback.json"), `${JSON.stringify({
  recipe,
  startedAt: new Date().toISOString(),
  projectPath: project,
  steps: [
    { role: "orchestrator", routingIntent: "none", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "scout", routingIntent: "quick", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "implementer", routingIntent: "general", result: "not_run", humanVerdict: "not_observed", notes: "" },
    { role: "verifier", routingIntent: "general", result: "not_run", humanVerdict: "not_observed", notes: "" }
  ],
  learning: ""
}, null, 2)}\n`);

const orchestratorPrompt = readFileSync(join(root, "recipes", recipe, "prompts", "orchestrator.md"), "utf8");
const outerPrompt = `${orchestratorPrompt}

## Current run
Project path: ${project}
Recipe: ${recipe}
Use delegate_worker for repository work. Worker results return through that tool. Do not use local run directory as a substitute for project evidence.`;
const outerTools = option("--outer-tools") ?? "read,grep,find,ls,delegate_worker";
const command = [
  "--model", model,
  "--extension", join(root, "extensions", "delegate-worker.ts"),
  "--tools", outerTools,
  "--append-system-prompt", outerPrompt,
  "--session-dir", join(runDirectory, "sessions")
];

console.log(`\nPatterns run: ${runDirectory}`);
console.log(`Outer model: ${model}`);
console.log("Workers load target project's normal Pi/Bifrost resources.");
console.log("Outer runs from isolated directory, so target project's local Bifrost does not load there.");
console.log("Warning: globally installed Bifrost may still load in outer session; v0 supports project-local Bifrost only.\n");

if (dryRun) {
  console.log(`Dry run: (cwd ${outerDirectory}) pi ${command.map(arg => JSON.stringify(arg)).join(" ")}`);
  process.exit(0);
}

const child = spawn("pi", command, {
  cwd: outerDirectory,
  stdio: "inherit",
  env: {
    ...process.env,
    BIFROST_PATTERN_PROJECT: project,
    BIFROST_PATTERN_ROOT: root,
    BIFROST_PATTERN_RUN_DIRECTORY: runDirectory
  }
});

child.on("exit", code => process.exit(code ?? 1));
