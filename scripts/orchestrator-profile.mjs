import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function orchestratorProfilePath(project) {
  return join(project, ".pi", "bifrost-patterns.json");
}

export function loadOrchestratorProfile(project) {
  const path = orchestratorProfilePath(project);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

export function saveOrchestratorModel({ project, recipe, model }) {
  const path = orchestratorProfilePath(project);
  const profile = loadOrchestratorProfile(project);
  const next = {
    ...profile,
    patterns: {
      ...profile.patterns,
      [recipe]: { ...profile.patterns?.[recipe], orchestratorModel: model }
    }
  };
  mkdirSync(join(project, ".pi"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return path;
}
