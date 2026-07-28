const strategies = new Set(["first", "cheapest", "cheapest_input", "cheapest_output", "largest_context", "random", "fastest"]);

export function buildConfigFragment({ configuredModels, tier, models, pattern, strategy = "first" }) {
  if (!/^[a-zA-Z]+$/.test(tier)) throw new Error("Tier must contain letters only so it can be used as a Bifrost named tier.");
  if (!Array.isArray(models) || !models.length) throw new Error("At least one evaluated model is required.");
  if (new Set(models).size !== models.length) throw new Error("Models must not repeat.");
  for (const model of models) if (!configuredModels.has(model)) throw new Error(`Model '${model}' is not configured in this project's Bifrost models.`);
  if (!strategies.has(strategy)) throw new Error("Invalid Bifrost strategy.");
  if (typeof pattern !== "string" || pattern.length > 240) throw new Error("Route pattern must be a compact JavaScript regex.");
  try { new RegExp(pattern, "i"); } catch { throw new Error("Route pattern is not a valid JavaScript regex."); }
  return {
    models: { [tier]: models },
    categoryStrategies: { [tier]: strategy },
    rules: [{ pattern, model: tier }],
  };
}
