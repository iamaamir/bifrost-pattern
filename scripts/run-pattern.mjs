import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { ensureBifrost } from "./bootstrap-bifrost.mjs";

const [recipe, possibleProject, ...remaining] = process.argv.slice(2);
const projectArg = possibleProject && !possibleProject.startsWith("-") ? possibleProject : ".";
const flags = possibleProject && !possibleProject.startsWith("-") ? remaining : [possibleProject, ...remaining].filter(Boolean);
const option = name => {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
};
const dryRun = flags.includes("--dry-run");
const yes = flags.includes("--yes");

if (recipe !== "fixed-orchestrator-workers") {
  console.error("Usage: bifrost-pattern fixed-orchestrator-workers [project-path] [--orchestrator-model provider/model] [--outer-tools tool,...] [--dry-run]");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(projectArg);
const manifest = join(root, "recipes", recipe, "recipe.json");
if (!existsSync(project) || !existsSync(manifest)) {
  console.error("Project path or recipe does not exist.");
  process.exit(1);
}

const sourceAgentDirectory = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
let bootstrap = dryRun
  ? { needsProbeConsent: false, models: [] }
  : ensureBifrost({ project, agentDirectory: sourceAgentDirectory, approveProbe: yes });
if (bootstrap.needsProbeConsent) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Bifrost must probe available models before first run. This makes provider calls and may consume quota. Continue? [y/N] ")).trim().toLowerCase();
  prompt.close();
  if (answer !== "y" && answer !== "yes") process.exit(1);
  bootstrap = ensureBifrost({ project, agentDirectory: sourceAgentDirectory, approveProbe: true });
}

const profilePath = join(project, ".bifrost-patterns.json");
const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : {};
let model = option("--orchestrator-model") ?? profile.patterns?.[recipe]?.orchestratorModel;

if (!model) {
  const candidates = bootstrap.models;
  const fzf = candidates.length > 0 && spawnSync("fzf", ["--height=60%", "--reverse", "--prompt=Outer-model> "], {
    input: `${candidates.join("\n")}\n`, encoding: "utf8"
  });
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  model = fzf?.status === 0 ? fzf.stdout.trim() : (await prompt.question(
    candidates.length > 0
      ? `Choose outer provider/model (${candidates.join(", ")}): `
      : "Choose outer provider/model: "
  )).trim();
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
const ledgerDirectory = join(project, ".pi", "bifrost-patterns", "runs");
const ledgerPath = join(ledgerDirectory, `${id}.json`);
const eventPath = join(ledgerDirectory, `${id}.events.jsonl`);
mkdirSync(outerDirectory, { recursive: true });
mkdirSync(join(outerDirectory, ".pi"), { recursive: true });
writeFileSync(join(outerDirectory, ".pi", "bifrost.json"), `${JSON.stringify({ enabled: false }, null, 2)}\n`);
mkdirSync(ledgerDirectory, { recursive: true });

writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, startedAt: new Date().toISOString(), outerModel: model, workers: [], routes: [], outcome: "running" }, null, 2)}\n`);

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
function createOuterAgentDirectory(runDirectory) {
  const source = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  const target = join(runDirectory, "agent");
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync(source)) {
    if (entry === "settings.json") continue;
    const destination = join(target, entry);
    if (!existsSync(destination)) symlinkSync(join(source, entry), destination);
  }

  const settingsPath = join(source, "settings.json");
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
  if (!(settings.packages ?? []).some(entry => String(entry).toLowerCase().includes("pi-subagents"))) {
    throw new Error("Pi-subagents is required. Run: pi install npm:pi-subagents");
  }
  writeFileSync(join(target, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
  return target;
}

const outerAgentDirectory = createOuterAgentDirectory(runDirectory);
const outerPrompt = `${orchestratorPrompt}

## Current run
Project path: ${project}
Recipe: ${recipe}
Use Pi-subagents subagent tool for repository work. Its policy pins every child to target project and disables project artifacts. Do not use local run directory as a substitute for project evidence.`;
const outerTools = option("--outer-tools") ?? "subagent,subagent_wait";
const command = [
  "--model", model,
  "--extension", join(root, "extensions", "bifrost-subagent-policy.ts"),
  "--tools", outerTools,
  "--append-system-prompt", outerPrompt,
  "--session-dir", join(runDirectory, "sessions")
];

console.log(`\nPatterns run: ${runDirectory}`);
console.log(`Outer model: ${model}`);
console.log("Workers load target project's normal Pi/Bifrost resources.");
console.log("Outer loads Bifrost disabled; workers load target-project Bifrost configuration.\n");

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
    BIFROST_PATTERN_RUN_DIRECTORY: runDirectory,
    PI_CODING_AGENT_DIR: outerAgentDirectory,
    PI_SUBAGENT_EXTRA_AGENT_DIRS: join(root, "agents"),
    BIFROST_PATTERN_RUN_ID: id,
    BIFROST_PATTERN_EVENT_PATH: eventPath
  }
});

child.on("exit", code => {
  const events = existsSync(eventPath)
    ? readFileSync(eventPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const debugPath = join(project, ".pi", "bifrost-debug.jsonl");
  const routes = existsSync(debugPath)
    ? readFileSync(debugPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
      .filter(entry => entry.pattern_run_id === id)
      .map(entry => ({ at: entry.ts, module: entry.module, event: entry.event, tier: entry.tier ?? entry.selectedTier, model: entry.model, fallbackReason: entry.fallbackReason }))
    : [];
  writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, startedAt: JSON.parse(readFileSync(ledgerPath, "utf8")).startedAt, endedAt: new Date().toISOString(), outerModel: model, workers: events, routes, outcome: code === 0 ? "completed" : "failed" }, null, 2)}\n`);
  process.exit(code ?? 1);
});
