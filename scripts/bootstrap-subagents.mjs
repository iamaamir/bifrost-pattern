import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PACKAGE = "pi-subagents";

function packagesIn(path) {
  if (!existsSync(path)) return [];
  const settings = JSON.parse(readFileSync(path, "utf8"));
  return (settings.packages ?? []).filter(entry => String(entry).toLowerCase().includes(PACKAGE));
}

function runPi(project, args) {
  const result = spawnSync("pi", args, { cwd: project, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Pi command failed: pi ${args.join(" ")}`);
}

export function subagentScopes(project, agentDirectory) {
  return {
    user: packagesIn(join(agentDirectory, "settings.json")),
    local: packagesIn(join(project, ".pi", "settings.json")),
  };
}

export function ensureSubagents({ project, agentDirectory }) {
  const scopes = subagentScopes(project, agentDirectory);
  if (scopes.user.length && scopes.local.length) {
    throw new Error("Pi-subagents exists in user and project scope. Remove one before running Patterns; duplicate loads are unsupported.");
  }
  if (!scopes.user.length && !scopes.local.length) {
    runPi(project, ["install", "-l", "npm:pi-subagents", "--approve"]);
    return { package: "npm:pi-subagents", baseDirectory: project };
  }
  return scopes.user.length
    ? { package: scopes.user[0], baseDirectory: agentDirectory }
    : { package: scopes.local[0], baseDirectory: project };
}
