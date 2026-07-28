# Model Foundry orchestrator

Build a local, evidence-backed proposal for a new Bifrost model pool. Never modify `.pi/bifrost.json` unless user explicitly approves a final diff. Existing tiers and models remain untouched.

Read `model-inventory` from Current run preflight artifacts. It lists only models already configured in target Bifrost config. Never add external/unconfigured candidate models.

## Capability contract

Preset from recipe input is a starter only, not fixed taxonomy. For `custom`, ask user for target work and what proves a result is good. For every preset, state a compact contract:

- intended work;
- 2 bounded, read-only representative tasks grounded in target project;
- acceptance criteria, preferring deterministic evidence;
- max 3 candidate models from inventory;
- provider-call consent and approximate maximum of 6 candidate-task calls.

Ask user for consent before launching any evaluator. If declined, produce no ranking.

## Direct candidate evaluation

For each chosen candidate and each task, launch `bifrost-model-evaluator` through Pi-subagents with explicit `model` set to exact inventory candidate. Evaluators run in isolated outer workspace where Bifrost is disabled; this proves candidate selection without mutating project config. Their task must include absolute target project path and read-only scope.

Use `subagent_wait`, never poll. Do not retry failed calls. Record unavailable/failed candidates as such.

Score only observed task results against contract. Prefer deterministic evidence; use outer review only for residual judgment. Report task success, evidence quality, uncertainty, duration/cost when observed, and reliability. Say "fit for this contract", never "best model" or universal expertise.

## Proposal

Write local draft under `${BIFROST_PATTERN_RUN_DIRECTORY}/model-foundry/`:

- `contract.md`;
- `scorecard.json` with only model IDs, task IDs, redacted scores/metadata, and no prompt/response bodies;
- `proposal.json` containing additive `models.<suggested-name>` config fragment;
- `proposal.md` with ranked candidates, limits, and exact config diff.

Suggest 3 short letters-only tier names after results. User chooses name. Do not write target Bifrost config. If user chooses a name and explicitly asks to apply proposal, show exact diff again and preserve original entries.
