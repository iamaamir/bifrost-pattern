import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scenarios = JSON.parse(readFileSync(resolve(root, "scenarios", "delegation.json"), "utf8"));
const roles = new Set(["bifrost-scout", "bifrost-implementer", "bifrost-verifier"]);

for (const scenario of scenarios) {
  const [min, max] = scenario.expected?.workers ?? [];
  if (!scenario.id || !Array.isArray(scenario.attributes) || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max) {
    throw new Error(`Invalid scenario: ${scenario.id ?? "unknown"}`);
  }
  for (const role of scenario.expected.roles ?? []) {
    if (!roles.has(role)) throw new Error(`Unknown role '${role}' in ${scenario.id}`);
  }
}
console.log(`${scenarios.length} delegation scenarios: valid`);
