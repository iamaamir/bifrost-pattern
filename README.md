# Bifrost Patterns Lab

Versioned, local-first workflow recipes that compose existing agent tools with [Pi-Bifrost](https://github.com/iamaamir/pi-bifrost).

This repository is **not** a Bifrost extension and does not modify Bifrost internals. Bifrost remains a routing primitive: it selects a configured model, persists reliability state, and exposes user controls. Recipes own workflow topology, prompts, evaluation, and local feedback.

## First pattern

[`fixed-orchestrator-workers`](recipes/fixed-orchestrator-workers/) keeps an outer orchestrator on an explicitly chosen fixed model while Pi worker sessions use their normal project Bifrost configuration.

```text
fixed/pinned orchestrator
  ├─ scout worker       → optional quick intent
  ├─ implement worker   → normal routing
  └─ verify worker      → optional quick/general intent
```

The orchestrator owns scope, delegation, review, and integration. Bifrost owns model selection within worker turns.

## Run a pattern

Install Patterns once during local development:

```bash
cd /Users/mak/git/bifrost-patterns
npm link
```

Then run from target project. Current directory is target; no project path is required:

```bash
bifrost-pattern fixed-orchestrator-workers
```

One command opens one outer Pi session. Pi-subagents owns async child processes, FleetView progress, completion batching, and worktree isolation; Patterns supplies Bifrost-specific roles and outer/worker separation.

On first run, runner prints `pi --list-models`, asks for an orchestrator `provider/model`, and saves that user-chosen value in target `.bifrost-patterns.json`. Pass it directly to avoid prompt:

```bash
bifrost-pattern fixed-orchestrator-workers \
  --orchestrator-model provider/model
```

Install Pi-subagents once first:

```bash
pi install npm:pi-subagents
```

Runner creates isolated outer Pi profile: it preserves configured user extensions and Pi-subagents while filtering package sources containing `pi-bifrost`. Bifrost loads only in worker processes, which use target project's normal Pi configuration. Pi-subagents keeps private temporary lifecycle/session state for async recovery and FleetView; Patterns sends no telemetry and creates no repository artifacts by default.

## Local-first feedback

Runs live under `runs/` in this repository. They record recipe ID, role, worker result, and human verdict. Patterns sends no telemetry and stores no prompt/provider-response data. Pi-subagents maintains private temporary local lifecycle/session state for active worker recovery.

```bash
npm run recipe:validate
npm run run:new -- fixed-orchestrator-workers /path/to/project
```

`run:new` creates a manual template. `pattern:run` is the normal one-command runner.

## Recipe contract

Every recipe declares:

- required public primitives and manual assumptions;
- topology and role boundaries;
- routing intent as a hint, never a hardcoded provider/model;
- safety rules and acceptance checks;
- local feedback shape.

See [`AGENTS.md`](AGENTS.md) for contributor rules.
