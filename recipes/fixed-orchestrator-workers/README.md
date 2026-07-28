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

## One-command run

Install/configure Bifrost **project-locally** in target project, then run from Patterns Lab:

```bash
npm run pattern:run -- fixed-orchestrator-workers /absolute/path/to/project
```

Runner lists available Pi models on first run and saves chosen outer model in target `.bifrost-patterns.json`. It opens one outer Pi session. Outer has read-only tools plus `delegate_worker`; it chooses scout/implementer/verifier and receives each worker result in same session.

Workers run in target project, so normal project Bifrost routing applies. Scout gets read-only tools; implementer gets edit/test tools; verifier gets read/test tools. Patterns worker guard blocks mutating Git commands.

Outer runs from isolated run directory, preserving global user extensions while avoiding target project-local Bifrost. V0 does not isolate a globally installed Bifrost.

## Manual fallback

If runner cannot launch in your environment, use [`prompts/orchestrator.md`](prompts/orchestrator.md) plus role prompts manually. Orchestrator alone reviews, integrates, and performs mutating Git operations after worker evidence.

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
