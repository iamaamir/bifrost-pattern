import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function persist(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function createRunMonitor({ runDirectory, projectPath, recipe, outerModel, recipeInputs, preflightArtifacts = {} }) {
  const jsonPath = join(runDirectory, "monitor.json");
  const jsonlPath = join(runDirectory, "monitor.jsonl");
  const state = {
    runDirectory,
    projectPath,
    recipe,
    outerModel,
    recipeInputs,
    preflightArtifacts,
    status: "booting",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: {},
    steps: [],
    workers: [],
    routes: [],
  };
  persist(jsonPath, state);
  appendFileSync(jsonlPath, `${JSON.stringify({ at: state.startedAt, event: "run.start", recipe, projectPath, outerModel })}\n`, { mode: 0o600 });
  return {
    jsonPath,
    jsonlPath,
    state,
    record(event, details = {}) {
      const entry = { at: new Date().toISOString(), event, ...details };
      appendFileSync(jsonlPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
      return entry;
    },
    update(patch = {}) {
      Object.assign(state, patch, { updatedAt: new Date().toISOString() });
      persist(jsonPath, state);
      return state;
    },
    finalize(patch = {}) {
      Object.assign(state, patch, { status: patch.status ?? patch.outcome ?? state.status, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      persist(jsonPath, state);
      appendFileSync(jsonlPath, `${JSON.stringify({ at: state.endedAt, event: "run.end", outcome: state.outcome ?? patch.outcome ?? "unknown", workers: state.workers?.length ?? 0 })}\n`, { mode: 0o600 });
      return state;
    },
  };
}
