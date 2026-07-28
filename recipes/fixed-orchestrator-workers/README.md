# Fixed orchestrator + Bifrost-routed workers

**Status:** experimental recipe. Prove assumptions in your environment before automating any launch behavior.

## When to use

Use when one senior/fixed-model orchestrator should preserve task context and make integration decisions, while bounded Pi workers can use Bifrost to select their configured model per assignment.

Do not use this recipe to hide model choices, replay failures, or let workers integrate their own Git changes.

## Topology

```text
outer orchestrator (fixed/pinned model)
  ├─ scout       read-only evidence
  ├─ implementer one bounded checkpoint
  └─ verifier    independent checks

workers: Bifrost normal routing
```

## Setup

1. Install/configure Bifrost in target project normally.
2. Start outer orchestrator with explicitly selected model; pin or bypass Bifrost in that outer session using public Bifrost/Pi controls. Pinning controls routing only.
3. Load [`prompts/orchestrator.md`](prompts/orchestrator.md) into outer session. It supplies delegation-only behavior: outer decides and reviews but does not inspect, edit, test, or execute repository work.
4. Launch workers in target project. Verify each worker loads project Bifrost configuration before relying on this recipe.
5. Give each worker one bounded brief from `prompts/`.
6. Orchestrator alone reviews, integrates, and performs mutating Git operations after worker evidence.
7. Create local feedback template:

```bash
npm run run:new -- fixed-orchestrator-workers /absolute/path/to/project
```

## Routing intent

Intent is a **hint**, not a forced model:

| Role | Suggested intent | Why |
|---|---|---|
| Scout | `quick` | bounded research and summaries |
| Implementer | `general` | normal code changes; Bifrost may escalate through existing rules/config |
| Verifier | `general` | focused checks and regression review |

Use a public Bifrost inline tier override only when task needs explicit policy. Never hardcode a provider/model in this recipe.

## Validate manually

- Outer model stayed fixed/pinned.
- Worker Bifrost status/debug/preview exposed a route.
- Worker result matched assigned scope.
- Any failure became a report for orchestrator; it was not automatically replayed.
- Record observed outcome in generated `feedback.json` without prompt body or secrets.

## Feedback questions

1. Was selected worker model appropriate?
2. Was routing decision visible enough to judge?
3. Did pin/bypass outer model behave predictably?
4. Did circuit state avoid a known unhealthy worker model?
5. Which Bifrost public primitive caused friction or was missing?
