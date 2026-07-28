import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function buildModelInventory(project) {
  const path = join(project, ".pi", "bifrost.json");
  if (!existsSync(path)) throw new Error("Bifrost configuration is missing.");
  const config = JSON.parse(readFileSync(path, "utf8"));
  const tiers = Object.entries(config.models ?? {}).map(([tier, value]) => ({ tier, models: Array.isArray(value) ? value : [value] }));
  const candidateTiers = new Map();
  for (const { tier, models } of tiers) for (const model of models) candidateTiers.set(model, [...(candidateTiers.get(model) ?? []), tier]);
  return { tiers, candidates: [...candidateTiers.entries()].map(([model, modelTiers]) => ({ model, tiers: modelTiers })) };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [project, output] = process.argv.slice(2);
  if (!project || !output) throw new Error("Usage: model-inventory <project> <output>");
  const inventory = buildModelInventory(project);
  writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 });
}
