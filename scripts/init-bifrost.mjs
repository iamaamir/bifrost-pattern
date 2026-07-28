import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { ensureBifrost, hasConfiguredBifrost } from "./bootstrap-bifrost.mjs";

const args = process.argv.slice(2);
const project = resolve(args.find(arg => !arg.startsWith("-")) ?? ".");
const yes = args.includes("--yes");
const agentDirectory = process.env.PI_CODING_AGENT_DIR ?? resolve(homedir(), ".pi", "agent");

if (!existsSync(project)) {
  console.error("Project path does not exist.");
  process.exit(1);
}

if (!yes) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question("Bifrost setup may install a project-local extension and probe provider models, which can consume quota. Continue? [y/N] ")).trim().toLowerCase();
  prompt.close();
  if (answer !== "y" && answer !== "yes") process.exit(0);
}

ensureBifrost({ project, agentDirectory, approveProbe: true });
if (!hasConfiguredBifrost(project, agentDirectory)) {
  console.error("Bifrost setup did not produce usable project configuration.");
  process.exit(1);
}
console.log("Bifrost ready for Patterns.");
