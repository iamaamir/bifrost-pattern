# Bifrost Pattern

Local-first workflow runner for [Pi-Bifrost](https://github.com/iamaamir/pi-bifrost) and [Pi-subagents](https://www.npmjs.com/package/pi-subagents).

Bifrost remains routing primitive. Pattern owns orchestration, worker lifecycle, local evidence, and task-specific role creation.

## Install

```bash
npm install -g bifrost-pattern
pi install npm:pi-subagents
```

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

Outer estimates scope, uncertainty, mechanical effort, risk, and parallel value. It chooses direct work or 0/1/2/N workers proportionately.

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

## Validation

```bash
npm test
npm run recipe:validate
npm run delegation:validate
```

See [`docs/delegation-tuning.md`](docs/delegation-tuning.md) for local effort-tuning loop.
