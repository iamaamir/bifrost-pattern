import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function packagesIn(path) {
  if (!existsSync(path)) return [];
  try {
    const settings = JSON.parse(readFileSync(path, "utf8"));
    return (settings.packages ?? []).filter(value => String(value).toLowerCase().includes("pi-bifrost"));
  } catch {
    throw new Error(`Cannot read Pi settings: ${path}`);
  }
}

function runPi(project, args) {
  const result = spawnSync("pi", args, { cwd: project, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Pi command failed: pi ${args.join(" ")}`);
}

export function bifrostScopes(project, agentDirectory) {
  const user = packagesIn(join(agentDirectory, "settings.json"));
  const local = packagesIn(join(project, ".pi", "settings.json"));
  return { user, local };
}

export function bifrostState(project, agentDirectory) {
  const scopes = bifrostScopes(project, agentDirectory);
  const hasPackage = Boolean(scopes.user.length || scopes.local.length);
  return {
    ...scopes,
    duplicate: Boolean(scopes.user.length && scopes.local.length),
    hasPackage,
    hasConfig: existsSync(join(project, ".pi", "bifrost.json")),
    hasProbe: existsSync(join(project, ".pi", "bifrost-probe.json")),
  };
}

export function hasConfiguredBifrost(project, agentDirectory) {
  const state = bifrostState(project, agentDirectory);
  return Boolean(!state.duplicate && state.hasPackage && state.hasConfig);
}

export function ensureBifrost({ project, agentDirectory, approveProbe }) {
  const initial = bifrostState(project, agentDirectory);
  if (initial.duplicate) {
    throw new Error("Bifrost exists in user and project scope. Remove one before running Patterns; duplicate loads create /bifrost:1.");
  }
  if (initial.hasConfig && initial.hasPackage) return { needsProbeConsent: false, models: modelsFromProbe(project) };
  if (!approveProbe) return { needsProbeConsent: true, models: [] };
  if (!initial.hasPackage) runPi(project, ["install", "-l", "npm:pi-bifrost", "--approve"]);
  if (!initial.hasConfig) {
    runPi(project, ["--no-session", "--approve", "--print", "/bifrost init --write"]);
    if (!existsSync(join(project, ".pi", "bifrost.json"))) {
      throw new Error("Bifrost init did not write .pi/bifrost.json. Install a Pi-Bifrost version supporting /bifrost init --write.");
    }
  }
  return { needsProbeConsent: false, models: modelsFromProbe(project) };
}

export function probeBifrost(project) {
  runPi(project, ["--no-session", "--approve", "--print", "/bifrost probe"]);
  return modelsFromProbe(project);
}

function modelsFromProbe(project) {
  const probe = join(project, ".pi", "bifrost-probe.json");
  if (!existsSync(probe)) return [];
  return [...new Set(JSON.parse(readFileSync(probe, "utf8"))
    .filter(entry => entry.status === "ok" && entry.provider && entry.model)
    .map(entry => `${entry.provider}/${entry.model}`))];
}
