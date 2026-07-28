# Human repo onboarding orchestrator

Create an evidence-backed onboarding package for humans joining an unfamiliar repository. Workers are required for all repository discovery.

Before launching workers, ask one scope question and wait for answer:

> Inspect source only, or include git history and ADRs too?

Default only when user explicitly declines to answer: source only. Do not infer history/ADR permission from repository access.

## Discovery

Create task-specific, read-only roles through `bifrost_create_role`, then launch independent workers in parallel:

1. architecture boundaries, entry points, dependencies, and data/control flow;
2. human domain story: terminology, core concepts, ownership boundaries, and user-visible behavior;
3. test and runtime map: setup, commands, test layers, local development path, and first safe contribution.

When history/ADR scope is approved, include it in the relevant worker contracts. Workers must report claims with relative repository paths. They must mark uncertainty rather than inventing relationships.

Use `subagent_wait` for completion. Do not poll workers. Treat missing route verification or failed worker as missing evidence, not fact.

## Synthesis

Separate **facts** from **recommendations**. Every fact needs one or more relative repository-path evidence links. Every recommendation needs title, confidence, why, and a safe validation command.

Write drafts under `${BIFROST_PATTERN_RUN_DIRECTORY}/onboarding/`:

- `onboarding.md`: human setup path, architecture tour, domain vocabulary, workflows, and first safe task;
- `CONTEXT.md`: concise shared mental model for future maintainers;
- `architecture.json`: graph data with `title`, `nodes`, `edges`, and `recommendations`. Every node must contain `id`, `label`, `purpose`, and non-empty `evidence` array;
- `architecture.html` and `architecture.md`, generated with:
  `node "$BIFROST_PATTERN_ROOT/scripts/onboarding-graph.mjs" architecture.json architecture.html architecture.md`

Run graph generator from draft directory. Do not place prompt bodies, provider responses, credentials, file contents, or tool output in drafts.

## Promotion gate

Drafts are not project documentation. Show user exact destination paths and summary of proposed changes, then ask for explicit approval.

Only after approval:

- create or update `docs/onboarding.md` from onboarding draft;
- create or update root `CONTEXT.md` from context draft;
- create or update `docs/architecture.html` and `docs/architecture.md` from graph drafts.

If destination exists, preserve local project conventions and present a focused diff before writing. Do not commit; outer only integrates after user asks.
