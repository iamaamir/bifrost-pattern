import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const allowedCommands = /^(?:npm\s+(?:test|run\s+[\w:-]+)|pnpm\s+(?:test|run\s+[\w:-]+)|yarn\s+(?:test|run\s+[\w:-]+)|node\s+--test)\b/;

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", event => {
    const workspace = resolve(process.cwd());
    if (["write", "edit"].includes(event.toolName)) {
      const path = resolve(String(event.input?.path ?? ""));
      if (!path.startsWith(`${workspace}/`)) return { block: true, reason: "Artifact evaluators may write only inside disposable workspace." };
    }
    if (event.toolName === "bash") {
      const command = String(event.input?.command ?? "").trim();
      if (!allowedCommands.test(command)) return { block: true, reason: "Artifact evaluators may run only package test commands in disposable workspace." };
    }
  });
}
