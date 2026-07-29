import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { ensureBifrost, hasConfiguredBifrost } from "./bootstrap-bifrost.mjs";
import { ensureSubagents } from "./bootstrap-subagents.mjs";
import { resolveRecipe } from "./recipe-resolver.mjs";
import { collectRecipeInputs, renderInitialMessage, resolveRecipeInputs } from "./recipe-inputs.mjs";
import { buildRepoIndex } from "./repo-index.mjs";
import { prepareAstGrep } from "./ast-grep.mjs";
import { buildModelInventory } from "./model-inventory.mjs";
import { resolveCapabilityPlan, selectOuterTools } from "./capability-plan.mjs";
import { loadOrchestratorProfile, saveOrchestratorModel } from "./orchestrator-profile.mjs";
import { createPatternStore } from "./pattern-store.mjs";
import { createRunMonitor } from "./run-monitor.mjs";
import { collectRunWorkers } from "./run-workers.mjs";
import { chooseRecipe } from "./recipe-picker.mjs";

const rawArgs = process.argv.slice(2);
const flags = [];
let recipeArg;
let projectArg = ".";
for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg === "--project") {
    projectArg = rawArgs[i + 1] ?? ".";
    i += 1;
    continue;
  }
  if (arg === "--orchestrator-model" || arg === "--input" || arg === "--outer-tools") {
    flags.push(arg, rawArgs[i + 1]);
    i += 1;
    continue;
  }
  if (arg.startsWith("-")) {
    flags.push(arg);
    continue;
  }
  if (!recipeArg) {
    recipeArg = arg;
    continue;
  }
  if (projectArg === ".") {
    projectArg = arg;
    continue;
  }
  flags.push(arg);
}
const option = name => {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
};
const options = name => flags.flatMap((flag, index) => flag === name && flags[index + 1] ? [flags[index + 1]] : []);
const dryRun = flags.includes("--dry-run");
const yes = flags.includes("--yes");
const installAstGrep = flags.includes("--install-ast-grep");
const help = flags.includes("--help") || flags.includes("-h");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(projectArg);
const store = createPatternStore(project);
if (help) {
  console.log("Usage: bifrost-pattern [recipe-id] [project-path] [--orchestrator-model provider/model] [--outer-tools tool,...] [--input name=value] [--install-ast-grep] [--dry-run] [--help]");
  process.exit(0);
}
if (!existsSync(project)) {
  console.error(`Project '${project}' does not exist.`);
  process.exit(1);
}
const selectedRecipe = recipeArg ? recipeArg : await chooseRecipe({ root, project });
const recipe = selectedRecipe.id ?? selectedRecipe;
let resolvedRecipe;
try {
  resolvedRecipe = resolveRecipe({ root, project, id: recipe });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const manifest = resolvedRecipe.manifest;
const capabilityPlan = resolveCapabilityPlan(manifest);
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
if (manifest.requiresExistingBifrost && !hasConfiguredBifrost(project, sourceAgentDirectory)) {
  if (dryRun) {
    console.error("This recipe requires existing project Bifrost setup. Run: bifrost-pattern init");
    process.exit(1);
  }
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Model Foundry needs Bifrost setup.\n\nSetup may install Pi-Bifrost and create project configuration.\n\n1) Set up Bifrost\n2) Exit\n\nChoose [1-2]: ")).trim();
  prompt.close();
  if (answer !== "1") process.exit(0);
  ensureBifrost({ project, agentDirectory: sourceAgentDirectory, approveProbe: true });
  if (!hasConfiguredBifrost(project, sourceAgentDirectory)) {
    console.error("Bifrost setup did not produce usable project configuration.");
    process.exit(1);
  }
}
const subagents = dryRun ? undefined : ensureSubagents({ project, agentDirectory: sourceAgentDirectory });
let bootstrap = dryRun
  ? { needsProbeConsent: false, models: [] }
  : ensureBifrost({ project, agentDirectory: sourceAgentDirectory, approveProbe: yes });
if (bootstrap.needsProbeConsent) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Bifrost setup is required before this run. It may install Pi-Bifrost and create configuration. Continue? [y/N] ")).trim().toLowerCase();
  prompt.close();
  if (answer !== "y" && answer !== "yes") process.exit(1);
  bootstrap = ensureBifrost({ project, agentDirectory: sourceAgentDirectory, approveProbe: true });
}

const profile = loadOrchestratorProfile(project);
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
  const profilePath = saveOrchestratorModel({ project, recipe, model });
  console.log(`Saved orchestrator model in ${profilePath}`);
}

const id = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${basename(project)}`;
const runDirectory = store.runs.directory(id);
const outerDirectory = join(runDirectory, "outer");
const ledgerDirectory = store.ledger.directory();
const ledgerPath = store.ledger.path(id);
const eventPath = join(ledgerDirectory, `${id}.events.jsonl`);
mkdirSync(outerDirectory, { recursive: true });
mkdirSync(join(outerDirectory, ".pi"), { recursive: true });
writeFileSync(join(outerDirectory, ".pi", "bifrost.json"), `${JSON.stringify({ enabled: false }, null, 2)}\n`);
mkdirSync(ledgerDirectory, { recursive: true });
const preflightArtifacts = {};
const monitor = createRunMonitor({ runDirectory, projectPath: project, recipe, outerModel: model, recipeInputs, preflightArtifacts });

let astGrep = { status: "not_requested" };
if (!dryRun && manifest.preflight?.some(step => step.capability === "repo-index")) {
  astGrep = await prepareAstGrep({
    project,
    approved: installAstGrep,
    ask: async question => {
      const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await prompt.question(question);
      } finally {
        prompt.close();
      }
    },
  });
  monitor.record("preflight.ast-grep", { ...astGrep, requested: true });
  if (astGrep.status === "manual") {
    console.error(`ast-grep install failed: ${astGrep.reason ?? "unknown reason"}. Install it manually, then rerun. Example: npm install --prefix .pi/bifrost-patterns/tools/ast-grep @ast-grep/cli@0.45.0 --no-audit --no-fund`);
    process.exit(1);
  }
  if (astGrep.status === "fallback") console.warn(`ast-grep install failed: ${astGrep.reason ?? "unknown reason"}; continuing with deterministic repository index.`);
}

if (!dryRun) for (const step of manifest.preflight ?? []) {
  if (step.capability === "repo-index") {
    const output = join(runDirectory, step.output);
    const index = buildRepoIndex({ project, cachePath: store.cache.repoIndexPath(), astGrepCommand: astGrep.command });
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
    preflightArtifacts[step.capability] = output;
    monitor.record("preflight.repo-index", {
      output,
      cacheHit: index.cacheHit,
      git: index.git,
      astGrep: index.capabilities.astGrep,
      summary: index.summary,
      entryCandidates: index.entryCandidates.length,
      testCandidates: index.testCandidates.length,
      snapshotFingerprint: index.snapshotFingerprint,
    });
    monitor.update({
      preflightArtifacts,
      bootstrap: { git: index.git, astGrep: index.capabilities.astGrep, repoIndex: { cacheHit: index.cacheHit, snapshotFingerprint: index.snapshotFingerprint } },
    });
    console.log(`Preflight repo index: ${output} (${index.cacheHit ? "cache hit" : "built"}; git ${index.git.shortSha} ${index.git.branch}${index.git.dirty ? " dirty" : ""}; ast-grep ${index.capabilities.astGrep.status})`);
  }
  if (step.capability === "model-inventory") {
    const output = join(runDirectory, step.output);
    const inventory = buildModelInventory(project);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 });
    preflightArtifacts[step.capability] = output;
    monitor.record("preflight.model-inventory", {
      output,
      candidateCount: inventory.candidates.length,
      tiers: inventory.tiers,
    });
    monitor.update({ preflightArtifacts });
    console.log(`Preflight model inventory: ${output} (${inventory.candidates.length} configured candidates)`);
  }
}

writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, recipe, startedAt: new Date().toISOString(), outerModel: model, workers: [], routes: [], outcome: "running" }, null, 2)}\n`);

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
const outerTools = selectOuterTools(capabilityPlan, option("--outer-tools")).join(",");
const extensionArgs = capabilityPlan.outer.extensions.flatMap(name => ["--extension", join(root, "extensions", `${name}.ts`)]);
const command = [
  "--model", model,
  ...extensionArgs,
  "--tools", outerTools,
  "--append-system-prompt", outerPrompt,
  "--session-dir", join(runDirectory, "sessions")
];
if (initialMessage) command.push(initialMessage);

console.log(`\nPatterns run: ${runDirectory}`);
console.log(`Outer model: ${model}`);
console.log("Workers load target project's normal Pi/Bifrost resources.");
console.log("Outer loads Bifrost disabled; workers load target-project Bifrost configuration.\n");
monitor.record("outer.ready", {
  model,
  recipeInputs,
  outerTools: outerTools ? outerTools.split(",").filter(Boolean) : [],
  capabilityKinds: { outer: capabilityPlan.outer.kind ?? capabilityPlan.outer, directWorkers: Object.keys(capabilityPlan.directWorkers) },
});
monitor.update({ outerModel: model, recipeInputs, preflightArtifacts });

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
    BIFROST_PATTERN_EVENT_PATH: eventPath,
    BIFROST_PATTERN_MONITOR_PATH: join(runDirectory, "monitor.json"),
    BIFROST_PATTERN_MONITOR_LOG_PATH: join(runDirectory, "monitor.jsonl"),
    BIFROST_PATTERN_CAPABILITY_PLAN: JSON.stringify(capabilityPlan)
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
  const workers = collectRunWorkers({
    project,
    runDirectory,
    runId: id,
    events,
    routes,
    phase: "final",
  }).map(worker => {
    const route = routes.find(candidate => candidate.event === "total" && candidate.subagentRunId === worker.runId);
    return {
      ...worker,
      routing: route ? { verified: true, model: route.model, tier: route.tier } : worker.source === "session" ? { verified: true, session: true, model: worker.model } : { verified: Boolean(worker.model), direct: Boolean(worker.direct), model: worker.model },
    };
  });
  const activities = events.filter(event => event.type !== "worker_terminal");
  const directWorkers = new Set(Object.keys(capabilityPlan.directWorkers));
  for (const worker of workers) if (directWorkers.has(worker.agent)) worker.routing = { verified: Boolean(worker.model), direct: true, model: worker.model };
  const failedWorkers = workers.filter(worker => worker.success === false || worker.routing.verified === false);
  const outcome = code === 0 && workers.length > 0 && failedWorkers.length === 0 ? "completed" : "failed";
  monitor.finalize({ outcome, workers, routes, activities, routingVerified: failedWorkers.length === 0, failedWorkers: failedWorkers.map(worker => ({ agent: worker.agent, runId: worker.runId, routingVerified: worker.routing.verified })) });
  writeFileSync(ledgerPath, `${JSON.stringify({ runId: id, recipe, startedAt: JSON.parse(readFileSync(ledgerPath, "utf8")).startedAt, endedAt: new Date().toISOString(), outerModel: model, workers, activities, routes, routingVerified: failedWorkers.length === 0, outcome }, null, 2)}\n`);
  console.log(`Monitor summary: ${monitor.jsonPath}`);
  if (manifest.cleanup?.onTerminal === "run-artifacts") store.runs.cleanup(id);
  process.exit(code ?? 1);
}
child.on("exit", finalize);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
