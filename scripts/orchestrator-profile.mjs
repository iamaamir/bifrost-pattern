import { createPatternStore } from "./pattern-store.mjs";

export function orchestratorProfilePath(project) {
  return createPatternStore(project).profile.path;
}

export function loadOrchestratorProfile(project) {
  return createPatternStore(project).profile.read();
}

export function saveOrchestratorModel({ project, recipe, model }) {
  return createPatternStore(project).profile.saveModel(recipe, model);
}
