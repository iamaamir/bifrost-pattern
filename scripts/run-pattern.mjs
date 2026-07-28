import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { ensureBifrost } from "./bootstrap-bifrost.mjs";
import { ensureSubagents } from "./bootstrap-subagents.mjs";
import { resolveRecipe } from "./recipe-resolver.mjs";
import { collectRecipeInputs, renderInitialMessage, resolveRecipeInputs } from "./recipe-inputs.mjs";
import { buildRepoIndex } from "./repo-index.mjs";
import { ensureAstGrep } from "./bootstrap-ast-grep.mjs";
import { buildModelInventory } from "./model-inventory.mjs";

const [recipe, possibleProject, ...remaining] = process.argv.slice(2);
const projectArg = possibleProject && !possibleProject.startsWith("-") ? possibleProject : ".";
const flags = possibleProject && !possibleProject.startsWith("-") ? remaining : [possibleProject, ...remaining].filter(Boolean);
const option = name => {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
};
const options = name => flags.flatMap((flag, index) => flag === name && flags[index + 1] ? [flags[index + 1]] : []);
const dryRun = flags.includes("--dry-run");
const yes = flags.includes("--yes");
const installAstGrep = flags.includes("--install-ast-grep");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(projectArg);
if (!recipe || !existsSync(project)) {
  console.error("Usage: bifrost-pattern <recipe-id> [project-path] [--orchestrator-model provider/model] [--outer-tools tool,...] [--input name=value] [--install-ast-grep] [--dry-run]");
  process.exit(1);
}
let resolvedRecipe;
try {
  resolvedRecipe = resolveRecipe({ root, project, id: recipe });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const manifest = resolvedRecipe.manifest;
const inputEntries = options("--input");
const recipeInputs = dryRun
  ? resolveRecipeInputs(manifest, inputEntries)
  : await (async () => {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await collectRecipeInputs(manifest, inputEntries, question => prompt.question(question));
    } finally {
      prompt.close();
    }
  })();
const initialMessage = renderInitialMessage(manifest, recipeInputs);

const sourceAgentDirectory = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
const subagents = dryRun ? undefined : ensureSubagents({ project, agentDirectory: sourceAgentDirectory });
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

let astGrep = { status: "not_requested" };
if (!dryRun && manifest.preflight?.some(step => step.capability === "repo-index")) {
  astGrep = ensureAstGrep({ project, approved: installAstGrep });
  if (astGrep.status === "unavailable" && !installAstGrep) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await prompt.question("ast-grep is not installed. Install pinned local AST index enhancer (@ast-grep/cli@0.45.0) under .pi/bifrost-patterns/tools? [y/N] ")).trim().toLowerCase();
    prompt.close();
    if (answer === "y" || answer === "yes") astGrep = ensureAstGrep({ project, approved: true });
  }
  if (astGrep.status === "failed") console.warn("ast-grep install failed; continuing with deterministic repository index.");
}

const id = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${basename(project)}`;
const runDirectory = join(project, ".pi", "bifrost-patterns", "outer-runs", id);
const outerDirectory = join(runDirectory, "outer");
const ledgerDirectory = join(project, ".pi", "bifrost-patterns", "runs");
const ledgerPath = join(ledgerDirectory, `${id}.json`);
const eventPath = join(ledgerDirectory, `${id}.events.jsonl`);
mkdirSync(outerDirectory, { recursive: true });
mkdirSync(join(outerDirectory, ".pi"), { recursive: true });
writeFileSync(join(outerDirectory, ".pi", "bifrost.json"), `${JSON.stringify({ enabled: false }, null, 2)}\n`);
mkdirSync(ledgerDirectory, { recursive: true });
const preflightArtifacts = {};
if (!dryRun) for (const step of manifest.preflight ?? []) {
  if (step.capability === "repo-index") {
    const output = join(runDirectory, step.output);
    const index = buildRepoIndex({ project, cachePath: join(project, ".pi", "bifrost-patterns", "cache", "repo-index.json"), astGrepCommand: astGrep.command });
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
    preflightArtifacts[step.capability] = output;
    console.log(`Preflight repo index: ${output} (${index.cacheHit ? "cache hit" : "built"}; ast-grep ${index.capabilities.astGrep.status})`);
  }
  if (step.capability === "model-inventory") {
    const output = join(runDirectory, step.output);
    const inventory = buildModelInventory(project);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 });
    preflightArtifacts[step.capability] = output;
    console.log(`Preflight model inventory: ${output} (${inventory.candidates.length} configured candidates)`);
  }
}

writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, startedAt: new Date().toISOString(), outerModel: model, workers: [], routes: [], outcome: "running" }, null, 2)}\n`);

writeFileSync(join(runDirectory, "feedback.json"), `${JSON.stringify({
  recipe,
  startedAt: new Date().toISOString(),
  projectPath: project,
  steps: [
    ...(manifest.roles ?? []).map(role => ({ role: role.id, routingIntent: role.routingIntent ?? "dynamic", result: "not_run", humanVerdict: "not_observed", notes: "" }))
  ],
  learning: ""
}, null, 2)}\n`);

const orchestratorPrompt = readFileSync(resolvedRecipe.promptPath, "utf8");
function createOuterAgentDirectory(runDirectory, subagents) {
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
  settings.packages = (settings.packages ?? []).map(entry => {
    if (typeof entry !== "string" || entry.startsWith("npm:") || entry.includes(":")) return entry;
    return resolve(source, entry);
  });
  if (!(settings.packages ?? []).some(entry => String(entry).toLowerCase().includes("pi-subagents"))) {
    const entry = subagents?.package ?? "npm:pi-subagents";
    settings.packages.push(typeof entry === "string" && !entry.startsWith("npm:") && !entry.includes(":")
      ? resolve(subagents.baseDirectory, entry)
      : entry);
  }
  writeFileSync(join(target, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
  return target;
}

const outerAgentDirectory = createOuterAgentDirectory(runDirectory, subagents);
const outerPrompt = `${orchestratorPrompt}

## Current run
Project path: ${project}
Recipe: ${recipe}
Run artifact directory: ${runDirectory}
Recipe inputs: ${JSON.stringify(recipeInputs)}
Preflight artifacts: ${JSON.stringify(preflightArtifacts)}
Use Pi-subagents subagent tool for repository work. Its policy pins every child to target project and disables project artifacts. Do not use local run directory as a substitute for project evidence.`;
const outerTools = option("--outer-tools") ?? "read,grep,find,ls,write,edit,bash,bifrost_create_role,subagent,subagent_wait";
const command = [
  "--model", model,
  "--extension", join(root, "extensions", "bifrost-subagent-policy.ts"),
  "--extension", join(root, "extensions", "role-compiler.ts"),
  "--extension", join(root, "extensions", "model-foundry-policy.ts"),
  "--extension", join(root, "extensions", "model-foundry-workspace.ts"),
  "--tools", outerTools,
  "--append-system-prompt", outerPrompt,
  "--session-dir", join(runDirectory, "sessions")
];
if (initialMessage) command.push(initialMessage);

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
    BIFROST_PATTERN_OUTER_DIRECTORY: outerDirectory,
    PI_CODING_AGENT_DIR: outerAgentDirectory,
    PI_SUBAGENT_EXTRA_AGENT_DIRS: join(root, "agents"),
    BIFROST_PATTERN_RUN_ID: id,
    BIFROST_PATTERN_EVENT_PATH: eventPath
  }
});

let finalizing = false;
function finalize(code) {
  if (finalizing) return;
  finalizing = true;
  const events = existsSync(eventPath)
    ? readFileSync(eventPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const debugPath = join(project, ".pi", "bifrost-debug.jsonl");
  const routes = existsSync(debugPath)
    ? readFileSync(debugPath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
      .filter(entry => entry.pattern_run_id === id)
      .map(entry => ({ at: entry.ts, subagentRunId: entry.subagent_run_id, module: entry.module, event: entry.event, tier: entry.tier ?? entry.selectedTier, model: entry.model, fallbackReason: entry.fallbackReason }))
    : [];
  const workers = events.filter(event => event.type === "worker_terminal").map(worker => {
    const route = routes.find(candidate => candidate.event === "total" && candidate.subagentRunId === worker.runId);
    return {
      ...worker,
      routing: route ? { verified: true, model: route.model, tier: route.tier } : { verified: false },
    };
  });
  const activities = events.filter(event => event.type !== "worker_terminal");
  const directWorkers = new Set(manifest.directWorkers ?? []);
  for (const worker of workers) if (directWorkers.has(worker.agent)) worker.routing = { verified: Boolean(worker.model), direct: true, model: worker.model };
  const failedWorkers = workers.filter(worker => worker.success !== true || worker.routing.verified !== true);
  const outcome = code === 0 && workers.length > 0 && failedWorkers.length === 0 ? "completed" : "failed";
  writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, startedAt: JSON.parse(readFileSync(ledgerPath, "utf8")).startedAt, endedAt: new Date().toISOString(), outerModel: model, workers, activities, routes, routingVerified: failedWorkers.length === 0, outcome }, null, 2)}\n`);
  if (manifest.cleanup?.onTerminal === "run-artifacts") rmSync(runDirectory, { recursive: true, force: true });
  process.exit(code ?? 1);
}
child.on("exit", finalize);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
