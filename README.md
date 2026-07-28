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

## Local-first feedback

Runs live under `runs/` in this repository. They record recipe ID, role, observed routing outcome, result, and human verdict. Prompt bodies, credentials, provider responses, and telemetry are never collected by the lab.

```bash
npm run recipe:validate
npm run run:new -- fixed-orchestrator-workers /path/to/project
```

`run:new` creates a local template and prints manual validation steps. It intentionally does **not** launch agents: Pi/orchestrator process inheritance and fixed-model pinning must be proven per environment before automation is added.

## Recipe contract

Every recipe declares:

- required public primitives and manual assumptions;
- topology and role boundaries;
- routing intent as a hint, never a hardcoded provider/model;
- safety rules and acceptance checks;
- local feedback shape.

See [`AGENTS.md`](AGENTS.md) for contributor rules.
