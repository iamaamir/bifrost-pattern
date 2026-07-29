# Architecture

Bifrost Pattern is local workflow runtime around Pi-Bifrost and Pi-subagents. It composes public interfaces; it does not alter Bifrost internals.

```text
user
  │
  ▼
bifrost-pattern CLI
  ├─ explicit Bifrost setup gate / init
  ├─ recipe resolution + input collection
  ├─ deterministic preflight
  ├─ isolated outer Pi session (Bifrost disabled)
  │    └─ Pi-subagents workers
  │         ├─ target-project Bifrost routing
  │         └─ direct evaluator mode when recipe declares it
  ├─ redacted local ledger
  └─ cleanup lifecycle
```

## Ownership boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Pi-Bifrost | routing, model selection, reliability, preview/pin/bypass, debug trace | workflow topology or orchestration |
| Pi-subagents | child session lifecycle | Bifrost policy changes |
| Pattern runtime | recipes, bootstrap, worker guards, role creation, preflight, correlation, ledgers, cleanup | provider proxying, hidden telemetry, Bifrost internals |
| Outer orchestrator | consent, planning, delegation, review, approved integration | unverified repository claims or worker bypass |
| Worker | bounded evidence or artifact work | Git integration, automatic replay, global policy |

## Process topology

### Outer

Runner starts an outer Pi session in an isolated run directory. Outer uses user-selected explicit `provider/model` and Bifrost is disabled there. This makes outer model pinning inspectable and prevents outer orchestration from being re-routed.

Outer session gets:

- resolved recipe prompt and declared inputs;
- paths to deterministic preflight artifacts;
- Pi-subagents and Pattern custom tools;
- generated-role directory registration.

### Standard workers

`bifrost-subagent-policy` pins standard worker CWD to target project, disables Pi-subagents artifacts, and attaches generic Git mutation guard. Target project normal Pi resources load, including its Bifrost configuration. Bifrost route debug evidence correlates worker run IDs with selected route/model in local ledger.

### Direct evaluators

Some recipes need exact candidate model selection, not routing. Manifest `directWorkers` declares these names. Model Foundry evaluators require explicit configured candidate model and run with Bifrost disabled.

Answer evaluators have read-only tools. Artifact evaluators use copied disposable workspaces, can write only there, and run only bounded package test commands. They never modify target project.

## Recipe system

`recipe-resolver` finds bundled recipe first, then project-local recipe. `recipe.json` is validated before launch. Recipe prompt supplies domain behavior; runtime supplies generic control plane.

Preflight runs before outer Pi starts:

```text
repo-index      → compact structural evidence, no source text
model-inventory → Bifrost configured tier/model references
```

Preflight output lives under run-local outer artifacts and is supplied by path to outer.

## Bifrost initialization

`bifrost-pattern init` is deterministic standalone setup:

```text
missing/partial setup → explicit consent → install/init → optional probe → open Pi
valid setup           → leave unchanged → open Pi
```

`--no-open` supports automation. Recipe-internal setup calls same primitive but never launches Pi. Existing valid Bifrost config is not reinstalled, rewritten, or re-probed by default.

## Evidence and privacy

Runtime writes redacted local records only:

```text
.pi/bifrost-patterns/runs/<run-id>.json
.pi/bifrost-patterns/runs/<run-id>.events.jsonl
```

Records identify lifecycle state, worker IDs, direct/routed model evidence, route metadata, and outcome. They exclude prompt bodies, provider replies, credentials, source content, and tool output. No remote telemetry exists.

## Cleanup

Most recipes can retain run-local artifacts until outer Pi exits, then `cleanup.onTerminal: "run-artifacts"` removes run directory. Model Foundry handles sensitive evaluation material earlier:

```text
completion tool
→ outer response settles
→ delete detailed contract, answers, workspaces, scorecards, drafts
→ outer Pi exits
→ delete remaining run/session directory
```

Redacted ledger remains outside outer-run directory.

## Safety model

Safety enforcement is runtime code, not model instruction alone:

- recipe manifest forbids automatic replay;
- worker guard blocks mutating Git commands;
- direct candidate model selection is explicit;
- answer evaluator toolset is read-only;
- artifact evaluator writes are sandbox-limited;
- config fragment builder validates tier names, configured models, strategy, and regex before proposal;
- Bifrost config changes remain explicit user action.

Prompt guidance remains advisory for architecture shape, visual design, and model ranking. Runtime enforces safety, evidence boundaries, and data integrity.
