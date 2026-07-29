import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function directory(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function createPatternStore(project) {
  const root = join(resolve(project), ".pi", "bifrost-patterns");
  const profilePath = join(root, "profile.json");
  const outerRuns = join(root, "outer-runs");
  const ledgers = join(root, "runs");
  const profile = {
    path: profilePath,
    read: () => existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : {},
    saveModel(recipe, model) {
      const current = profile.read();
      const next = { ...current, patterns: { ...current.patterns, [recipe]: { ...current.patterns?.[recipe], orchestratorModel: model } } };
      directory(root);
      writeFileSync(profilePath, `${JSON.stringify(next, null, 2)}\n`);
      return profilePath;
    },
  };
  return {
    root,
    profile,
    agents: { directory: () => join(root, "agents") },
    recipes: { directory: () => join(root, "recipes") },
    cache: { repoIndexPath: () => join(root, "cache", "repo-index.json") },
    tools: { astGrepDirectory: () => join(root, "tools", "ast-grep"), astGrepCommand: () => join(root, "tools", "ast-grep", "node_modules", ".bin", process.platform === "win32" ? "sg.cmd" : "sg") },
    runs: {
      directory: id => join(outerRuns, id),
      create: id => directory(join(outerRuns, id)),
      cleanup: id => rmSync(join(outerRuns, id), { recursive: true, force: true }),
      cleanupFoundry: id => {
        const run = join(outerRuns, id);
        rmSync(join(run, "model-foundry"), { recursive: true, force: true });
        rmSync(join(run, "agent"), { recursive: true, force: true });
      },
    },
    ledger: { path: id => join(ledgers, `${id}.json`), directory: () => directory(ledgers) },
    manualRuns: { directory: id => join(root, "manual-runs", id), create: id => directory(join(root, "manual-runs", id)) },
  };
}
