import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const roleProfiles = {
  scout: { tools: "read,grep,find,ls", prompt: "scout.md" },
  implementer: { tools: "read,grep,find,ls,write,edit,bash", prompt: "implementer.md" },
  verifier: { tools: "read,grep,find,ls,bash", prompt: "verifier.md" }
} as const;

type Role = keyof typeof roleProfiles;

function runtime() {
  const project = process.env.BIFROST_PATTERN_PROJECT;
  const root = process.env.BIFROST_PATTERN_ROOT;
  const runDirectory = process.env.BIFROST_PATTERN_RUN_DIRECTORY;
  if (!project || !root || !runDirectory) throw new Error("Patterns runner environment is incomplete");
  return { project, root, runDirectory };
}

function workerPrompt(root: string, role: Role) {
  return readFileSync(join(root, "recipes", "fixed-orchestrator-workers", "prompts", roleProfiles[role].prompt), "utf8");
}

function appendResult(runDirectory: string, role: Role, result: string) {
  appendFileSync(join(runDirectory, "worker-events.jsonl"), `${JSON.stringify({
    at: new Date().toISOString(),
    role,
    result
  })}\n`);
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "delegate_worker",
    label: "Delegate worker",
    description: "Run one bounded scout, implementer, or verifier worker in target project. Worker uses normal project Bifrost routing.",
    parameters: Type.Object({
      role: Type.Union([Type.Literal("scout"), Type.Literal("implementer"), Type.Literal("verifier")]),
      assignment: Type.String({ description: "Bounded worker assignment. Do not include credentials or secrets." }),
      acceptanceCriteria: Type.String({ description: "Observable completion criteria." })
    }),
    async execute(_toolCallId, params) {
      const role = params.role as Role;
      const { project, root, runDirectory } = runtime();
      const prompt = `${workerPrompt(root, role)}\n\nAssignment: ${params.assignment}\n\nAcceptance criteria: ${params.acceptanceCriteria}`;
      const child = spawnSync("pi", [
        "--no-session",
        "--approve",
        "--extension", join(root, "extensions", "worker-guard.ts"),
        "--tools", roleProfiles[role].tools,
        "--append-system-prompt", prompt,
        "--print", "Complete your bounded assignment."
      ], {
        cwd: project,
        encoding: "utf8",
        env: process.env,
        maxBuffer: 1024 * 1024
      });

      const output = `${child.stdout ?? ""}${child.stderr ?? ""}`.trim();
      const result = child.status === 0 ? "success" : "failure";
      appendResult(runDirectory, role, result);
      return {
        content: [{ type: "text", text: `Worker ${role}: ${result}\n\n${output || "No worker output."}` }],
        details: { role, result }
      };
    }
  });
}
