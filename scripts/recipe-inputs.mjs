function declarations(recipe) {
  return recipe.inputs ?? [];
}

function suppliedMap(entries) {
  const values = {};
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error(`Recipe input '${entry}' must use name=value.`);
    values[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return values;
}

export function resolveRecipeInputs(recipe, entries) {
  const values = suppliedMap(entries);
  const inputs = declarations(recipe);
  const known = new Set(inputs.map(input => input.id));
  for (const key of Object.keys(values)) if (!known.has(key)) throw new Error(`Recipe has unknown input '${key}'.`);
  const resolved = {};
  for (const input of inputs) {
    const value = values[input.id] ?? input.default;
    if (value === undefined) throw new Error(`Recipe '${recipe.id ?? "unknown"}' requires input '${input.id}'.`);
    if (!input.options.some(option => option.value === value)) throw new Error(`Input '${input.id}' must be one of: ${input.options.map(option => option.value).join(", ")}.`);
    resolved[input.id] = value;
  }
  return resolved;
}

export async function collectRecipeInputs(recipe, entries, ask) {
  const supplied = suppliedMap(entries);
  const inputs = declarations(recipe);
  const known = new Set(inputs.map(input => input.id));
  for (const key of Object.keys(supplied)) if (!known.has(key)) throw new Error(`Recipe has unknown input '${key}'.`);
  for (const input of inputs) {
    if (supplied[input.id] !== undefined) continue;
    const choices = input.options.map(option => `${option.value} (${option.label})`).join(", ");
    const answer = (await ask(`${input.prompt} [${choices}]: `)).trim();
    if (!answer && input.default !== undefined) supplied[input.id] = input.default;
    else supplied[input.id] = answer;
  }
  return resolveRecipeInputs(recipe, Object.entries(supplied).map(([key, value]) => `${key}=${value}`));
}

export function renderInitialMessage(recipe, inputs) {
  const template = recipe.outer?.initialMessage;
  if (!template) return undefined;
  return template.replaceAll(/{{([a-zA-Z][a-zA-Z0-9_-]*)}}/g, (_match, id) => {
    if (!(id in inputs)) throw new Error(`Initial message references unknown input '${id}'.`);
    return inputs[id];
  });
}
