import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const AST_GREP_VERSION = "0.45.0";

function localCommand(project) {
  return join(project, ".pi", "bifrost-patterns", "tools", "ast-grep", "node_modules", ".bin", process.platform === "win32" ? "sg.cmd" : "sg");
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
  const directory = join(project, ".pi", "bifrost-patterns", "tools", "ast-grep");
  const result = run("npm", ["install", "--prefix", directory, `@ast-grep/cli@${AST_GREP_VERSION}`, "--no-audit", "--no-fund"], { cwd: project, stdio: "inherit" });
  if (result?.status !== 0) return { status: "failed" };
  const installed = locateAstGrep({ project, run });
  return installed.status === "available" ? { ...installed, status: "installed" } : { status: "failed" };
}
