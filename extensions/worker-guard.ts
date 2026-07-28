import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mutatingGit = /\bgit\s+(add|am|apply|bisect|branch|checkout|cherry-pick|clean|commit|config|fetch|merge|pull|push|rebase|reset|restore|revert|stash|switch|tag)\b/i;

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const command = String(event.input?.command ?? "");
    if (mutatingGit.test(command)) {
      return { block: true, reason: "Patterns workers may not run mutating Git commands." };
    }
  });
}
