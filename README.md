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

One command opens one outer Pi session. Outer decides which workers to delegate; workers run in background child Pi processes and use target project's normal Bifrost configuration.

```bash
npm run pattern:run -- fixed-orchestrator-workers /path/to/project
```

On first run, runner prints `pi --list-models`, asks for an orchestrator `provider/model`, and saves that user-chosen value in target `.bifrost-patterns.json`. Pass it directly to avoid prompt:

```bash
npm run pattern:run -- fixed-orchestrator-workers /path/to/project \
  --orchestrator-model provider/model
```

Runner creates isolated outer Pi profile: it preserves configured user extensions while filtering package sources containing `pi-bifrost`. Bifrost loads only in worker processes, which use target project's normal Pi configuration.

## Local-first feedback

Runs live under `runs/` in this repository. They record recipe ID, role, worker result, and human verdict. Prompt bodies, credentials, provider responses, and telemetry are never collected by the lab.

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
