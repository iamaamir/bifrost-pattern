import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { ensureBifrost, hasConfiguredBifrost, probeBifrost } from "./bootstrap-bifrost.mjs";

const args = process.argv.slice(2);
const project = resolve(args.find(arg => !arg.startsWith("-")) ?? ".");
const yes = args.includes("--yes");
const noOpen = args.includes("--no-open");
const forceProbe = args.includes("--probe");
const agentDirectory = process.env.PI_CODING_AGENT_DIR ?? resolve(homedir(), ".pi", "agent");

if (!existsSync(project)) {
  console.error("Project path does not exist.");
  process.exit(1);
}

const configured = hasConfiguredBifrost(project, agentDirectory);
if (!configured && !yes) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Bifrost setup may install a project-local extension and create configuration. Continue? [y/N] ")).trim().toLowerCase();
  prompt.close();
  if (answer !== "y" && answer !== "yes") process.exit(0);
}

if (!configured) ensureBifrost({ project, agentDirectory, approveProbe: true });
if (!hasConfiguredBifrost(project, agentDirectory)) {
  console.error("Bifrost setup did not produce usable project configuration.");
  process.exit(1);
}

if ((!configured || forceProbe) && !yes) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Probe configured providers now? Provider calls may consume quota. [y/N] ")).trim().toLowerCase();
  prompt.close();
  if (answer === "y" || answer === "yes") probeBifrost(project);
} else if (forceProbe) {
  probeBifrost(project);
}

console.log(configured ? "Bifrost already configured." : "Bifrost ready.");
if (!noOpen) {
  console.log("Opening Pi…");
  const result = spawnSync("pi", [], { cwd: project, stdio: "inherit" });
  process.exit(result.status ?? 1);
}
