# Fixed orchestrator + Bifrost-routed workers

**Status:** experimental recipe. Prove assumptions in your environment before automating any launch behavior.

## When to use

Use when one senior/fixed-model orchestrator should preserve task context and make integration decisions, while bounded Pi workers can use Bifrost to select their configured model per assignment.

Do not use this recipe to hide model choices, replay failures, or let workers integrate their own Git changes.

## Topology

```text
outer orchestrator (fixed/pinned model)
  ├─ scout       one exact slice, read-only evidence
  ├─ implementer one bounded checkpoint
  └─ verifier    independent checks

workers: Bifrost normal routing
```

## One-command run

Install/configure Bifrost in target project normally. Install Patterns once with `npm link` from Patterns Lab, then run from target project:

```bash
bifrost-pattern fixed-orchestrator-workers
```

Install Pi-subagents once before first run:

```bash
pi install npm:pi-subagents
```

Runner lists available Pi models on first run and saves chosen outer model in target `.pi/bifrost-patterns/profile.json`. It opens one outer Pi session with Pi-subagents FleetView. Outer has only `subagent` and `subagent_wait`; it launches `bifrost-scout`, `bifrost-implementer`, and `bifrost-verifier` workers and receives batched completion wakeups in same session.

Workers run in target project, so normal project Bifrost routing applies. Read-only workers can run in parallel. Pi-subagents worktrees are required for parallel writers. Role policies scope tools; Patterns worker guard blocks mutating Git commands.

Outer runs from isolated profile. Runner preserves user extensions and Pi-subagents but filters configured Bifrost package sources, so selected outer model stays fixed. Workers use normal target project configuration and Bifrost routing. Pi-subagents retains private temporary local lifecycle/session state for async recovery and FleetView; Patterns writes no repository artifacts by default.

## Manual fallback

If runner cannot launch in your environment, use [`prompts/orchestrator.md`](prompts/orchestrator.md) plus role prompts manually. Orchestrator alone reviews, integrates, and performs mutating Git operations after worker evidence.

This recipe now seeds a preflight `repo-index` with git SHA, branch, and AST/graph evidence, then uses it as graph-first bootstrap. Workers get an exact slice pack instead of cold-start discovery. Scout retries stay on same slice once only; no random flow, no fallback wandering. Each run also writes `monitor.json` and `monitor.jsonl` under `.pi/bifrost-patterns/runs/<run-id>/` so you can inspect bootstrap, preflight, and completion without extra commands.

For the memory and bootstrap design behind this recipe, see [`docs/repo-memory-bootstrap.md`](../../docs/repo-memory-bootstrap.md).

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
