import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createPatternStore } from "./pattern-store.mjs";

export const AST_GREP_VERSION = "0.45.0";

function localCommand(project) {
  return createPatternStore(project).tools.astGrepCommand();
}

function versionOf(command, project, run) {
  const result = run(command, ["--version"], { cwd: project, encoding: "utf8" });
  return result?.status === 0 ? String(result.stdout ?? "").trim() : undefined;
}

export function locateAstGrep({ project, run = spawnSync }) {
  for (const command of ["sg", "ast-grep", localCommand(project)]) {
    if (command.includes("node_modules") && !existsSync(command) && run === spawnSync) continue;
    const version = versionOf(command, project, run);
    if (version) return { status: "available", command, version };
  }
  return { status: "unavailable" };
}

export function ensureAstGrep({ project, approved, run = spawnSync }) {
  const existing = locateAstGrep({ project, run });
  if (existing.status === "available") return existing;
  if (!approved) return existing;
  const directory = createPatternStore(project).tools.astGrepDirectory();
  const result = run("npm", ["install", "--prefix", directory, `@ast-grep/cli@${AST_GREP_VERSION}`, "--no-audit", "--no-fund"], { cwd: project, stdio: "inherit" });
  if (result?.status !== 0) return { status: "failed", reason: "npm install failed" };
  const installed = locateAstGrep({ project, run });
  return installed.status === "available"
    ? { ...installed, status: "installed" }
    : { status: "failed", reason: "ast-grep binary unavailable after install" };
}

export async function prepareAstGrep({ project, approved, ask, run = spawnSync }) {
  const existing = locateAstGrep({ project, run });
  if (existing.status === "available") return existing;
  let shouldInstall = approved;
  if (!shouldInstall && ask) {
    const answer = String(await ask(
      `ast-grep is not installed. Install pinned local AST index enhancer (@ast-grep/cli@${AST_GREP_VERSION}) under .pi/bifrost-patterns/tools? [y/N] `,
    )).trim().toLowerCase();
    shouldInstall = answer === "y" || answer === "yes";
  }
  if (!shouldInstall) return existing;
  const installed = ensureAstGrep({ project, approved: true, run });
  if (installed.status === "available" || installed.status === "installed") return installed;
  if (!ask) return installed;
  const answer = String(await ask(
    `ast-grep install failed (${installed.reason ?? "unknown reason"}).\n\n1) Install it manually and exit\n2) Continue without AST-grep fallback\n\nChoose [1-2]: `,
  )).trim().toLowerCase();
  if (answer === "1") return { status: "manual", reason: installed.reason ?? "ast-grep install failed" };
  if (answer === "2") return { status: "fallback", reason: installed.reason ?? "ast-grep install failed" };
  return { status: "fallback", reason: installed.reason ?? "ast-grep install failed" };
}

export function astGrepOutline(project, run = spawnSync, command) {
  const located = command
    ? (() => { const result = run(command, ["--version"], { cwd: project, encoding: "utf8" }); return result?.status === 0 ? { status: "available", command, version: String(result.stdout ?? "").trim() } : { status: "unavailable" }; })()
    : locateAstGrep({ project, run });
  if (located.status !== "available") return { status: "unavailable", symbols: [] };
  const outline = run(located.command, ["outline", ".", "--json=compact"], { cwd: project, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  if (outline?.status !== 0) return { status: "failed", command: located.command, version: located.version, symbols: [] };
  try {
    const parsed = JSON.parse(String(outline.stdout ?? "[]"));
    const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
    const symbols = items.slice(0, 250).flatMap(item => {
      const file = item.file ?? item.path;
      const name = item.name;
      if (!file || !name) return [];
      return [{ file, name, kind: item.symbolType ?? item.kind ?? "symbol", line: item.range?.start?.line ?? item.start?.line ?? 0 }];
    });
    return { status: "available", command: located.command, version: located.version, symbols };
  } catch { return { status: "failed", command: located.command, version: located.version, symbols: [] }; }
}
