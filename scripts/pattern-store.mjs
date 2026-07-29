import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function directory(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

function artifactId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 255 || value === "." || value === ".." || /[\\/\0]/.test(value)) {
    throw new Error("Expected a safe artifact identifier.");
  }
  return value;
}

function writeJson(path, value) {
  directory(resolve(path, ".."));
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function createPatternStore(project) {
  const root = join(resolve(project), ".pi", "bifrost-patterns");
  const profilePath = join(root, "profile.json");
  const outerRuns = join(root, "outer-runs");
  const ledgers = join(root, "runs");
  const runDirectory = id => join(outerRuns, artifactId(id));
  const profile = {
    path: profilePath,
    read: () => existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : {},
    saveModel(recipe, model) {
      const current = profile.read();
      const next = { ...current, patterns: { ...current.patterns, [artifactId(recipe)]: { ...current.patterns?.[recipe], orchestratorModel: model } } };
      writeJson(profilePath, next);
      return profilePath;
    },
  };
  return {
    root,
    profile,
    agents: { directory: () => join(root, "agents") },
    recipes: { directory: id => join(root, "recipes", artifactId(id)) },
    cache: { repoIndexPath: () => join(root, "cache", "repo-index.json") },
    tools: { astGrepDirectory: () => join(root, "tools", "ast-grep"), astGrepCommand: () => join(root, "tools", "ast-grep", "node_modules", ".bin", process.platform === "win32" ? "ast-grep.cmd" : "ast-grep") },
    runs: {
      directory: runDirectory,
      create: id => directory(runDirectory(id)),
      cleanup: id => rmSync(runDirectory(id), { recursive: true, force: true }),
      foundryWorkspace: (id, name) => join(runDirectory(id), "model-foundry", "workspaces", artifactId(name)),
      createFoundryWorkspace: (id, name) => directory(join(runDirectory(id), "model-foundry", "workspaces", artifactId(name))),
      foundryCompletionPath: id => join(runDirectory(id), ".model-foundry-complete.json"),
      cleanupFoundry: id => {
        const run = runDirectory(id);
        rmSync(join(run, "model-foundry"), { recursive: true, force: true });
        rmSync(join(run, "agent"), { recursive: true, force: true });
      },
    },
    ledger: { path: id => join(ledgers, `${artifactId(id)}.json`), directory: () => directory(ledgers) },
    manualRuns: { directory: id => join(root, "manual-runs", artifactId(id)), create: id => directory(join(root, "manual-runs", artifactId(id))) },
  };
}
