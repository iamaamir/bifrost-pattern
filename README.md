# Bifrost Pattern

Local-first workflow runner for [Pi-Bifrost](https://github.com/iamaamir/pi-bifrost) and [Pi-subagents](https://www.npmjs.com/package/pi-subagents).

Bifrost remains routing primitive. Pattern owns orchestration, worker lifecycle, local evidence, and task-specific role creation.

## Install

```bash
npm install -g bifrost-pattern
```

Bifrost Pattern installs Pi-Bifrost and Pi-subagents project-local when absent. It stops if either extension exists in both user and project scopes.

## Initialize Bifrost

For a project without Bifrost:

```bash
bifrost-pattern init
```

Fresh setup explicitly asks before project-local install and optional provider probing, then opens interactive Pi in target project. Existing valid setup is left unchanged and opens Pi directly. Use `--no-open` for automation or `--probe` to refresh provider probes.

## Run

From target project:

```bash
bifrost-pattern fixed-orchestrator-workers
```

First run probes Bifrost models with consent, then asks for fixed outer `provider/model`. Chosen model is saved in target `.bifrost-patterns.json`.

## Model

```text
fixed outer orchestrator
  └─ task-shaped Pi-subagent workers
       └─ target-project Bifrost routing
```

Outer estimates scope, uncertainty, mechanical effort, risk, and parallel value. Repository inspection and substantive artifact work require 1/2/N workers; outer directly handles only conversation, coordination, and integration of established evidence.

Workers are not fixed taxonomy. Outer reuses a fitting project role or calls `bifrost_create_role` to create a validated task-specific role. Generated roles persist for tuning/reuse at:

```text
.pi/bifrost-patterns/agents/<role>.md
```

Patterns enforces target CWD, generic worker Git guard, Bifrost route correlation, and redacted local lifecycle ledger. No remote telemetry. It never stores prompts, provider responses, credentials, file contents, or tool output.

Run data stays inside target project:

```text
.pi/bifrost-patterns/runs/
.pi/bifrost-patterns/outer-runs/
```

## Recipes

```bash
npx bifrost-pattern fixed-orchestrator-workers
npx bifrost-pattern repo-onboarding
npx bifrost-pattern model-foundry
```

`repo-onboarding` creates human guide, `CONTEXT.md`, and accessible interactive HTML/Mermaid architecture-graph drafts. Before Pi opens, runner asks whether to include git history/ADRs; Pi then starts work immediately. It builds a local, cached deterministic repo index so workers target evidence files rather than dump source trees. It asks again before promoting drafts into project docs.

`model-foundry` evaluates only models already present in project Bifrost config against a user-selected or custom work contract. If setup is missing, it offers explicit `init` setup or exit. It produces a local scorecard and additive config proposal, never writes Bifrost config without explicit approval.

## Add a pattern

Recipes are declarative folders: `recipe.json`, `prompts/`, `scenarios/`, and `README.md`. Runtime bootstrap, worker lifecycle, routing correlation, and ledger stay in core runner.

Resolution order:

```text
bundled recipes
→ .pi/bifrost-patterns/recipes/<recipe-id>/
```

A project recipe needs a positive integer `version`, `runtime: "pi"`, `safety.automaticPromptReplay: false`, and an `outer.prompt` Markdown file. Recipes may declare select inputs; runner collects them before Pi starts. Pass values noninteractively with `--input name=value`.

## Validation

```bash
npm test
npm run recipe:validate
npm run delegation:validate
```

See [`docs/delegation-tuning.md`](docs/delegation-tuning.md) for local effort-tuning loop.
