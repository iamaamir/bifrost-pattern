import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

export function hasConfiguredBifrost(project, agentDirectory) {
  const scopes = bifrostScopes(project, agentDirectory);
  return Boolean((scopes.user.length || scopes.local.length) && existsSync(join(project, ".pi", "bifrost.json")));
}

export function ensureBifrost({ project, agentDirectory, approveProbe }) {
  const scopes = bifrostScopes(project, agentDirectory);
  if (scopes.user.length && scopes.local.length) {
    throw new Error("Bifrost exists in user and project scope. Remove one before running Patterns; duplicate loads create /bifrost:1.");
  }
  if (!scopes.user.length && !scopes.local.length) {
    runPi(project, ["install", "-l", "npm:pi-bifrost", "--approve"]);
  }

  const config = join(project, ".pi", "bifrost.json");
  const probe = join(project, ".pi", "bifrost-probe.json");
  if (!existsSync(config)) {
    if (!approveProbe) return { needsProbeConsent: true, models: [] };
    runPi(project, ["--no-session", "--approve", "--print", "/bifrost init --write"]);
    if (!existsSync(config)) {
      throw new Error("Bifrost init did not write .pi/bifrost.json. Install a Pi-Bifrost version supporting /bifrost init --write.");
    }
  } else if (!existsSync(probe) && approveProbe) {
    runPi(project, ["--no-session", "--approve", "--print", "/bifrost probe"]);
  }

  if (existsSync(config)) {
    const configData = JSON.parse(readFileSync(config, "utf8"));
    configData.debug = { ...(configData.debug ?? {}), enabled: true };
    writeFileSync(config, `${JSON.stringify(configData, null, 2)}\n`);
  }

  const models = existsSync(probe)
    ? JSON.parse(readFileSync(probe, "utf8"))
      .filter(entry => entry.status === "ok" && entry.provider && entry.model)
      .map(entry => `${entry.provider}/${entry.model}`)
    : [];
  return { needsProbeConsent: false, models: [...new Set(models)] };
}
