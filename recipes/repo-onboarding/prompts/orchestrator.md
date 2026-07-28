# Human repo onboarding orchestrator

Create an evidence-backed onboarding package for humans joining an unfamiliar repository. Workers are required for all repository discovery.

Discovery scope comes from recipe preflight in initial user message. Do not ask again. Do not infer history/ADR permission beyond that selected scope.

## Discovery

Read `repo-index` from Current run preflight artifacts before launching workers. It is a local deterministic map: file counts, manifests, entry/test candidates, and bounded import edges. Use it to target worker evidence reads; do not dump or summarize whole source trees. Index is orientation only, never evidence: workers must verify final claims against referenced repository paths.

Create task-specific, read-only roles through `bifrost_create_role`, then launch independent workers in parallel:

1. architecture boundaries, entry points, dependencies, and data/control flow;
2. human domain story: terminology, core concepts, ownership boundaries, and user-visible behavior;
3. test and runtime map: setup, commands, test layers, local development path, and first safe contribution.

When scope is `source-history-adrs`, include history/ADR inspection in relevant worker contracts. Workers must report claims with relative repository paths. They must mark uncertainty rather than inventing relationships.

Use `subagent_wait` for completion. Do not poll workers. Treat missing route verification or failed worker as missing evidence, not fact.

## Synthesis

Separate **facts** from **recommendations**. Every fact needs one or more relative repository-path evidence links. Every recommendation needs title, confidence, why, and a safe validation command.

Write drafts under `${BIFROST_PATTERN_RUN_DIRECTORY}/onboarding/`:

- `onboarding.md`: human setup path, architecture tour, domain vocabulary, workflows, and first safe task;
- `CONTEXT.md`: concise shared mental model for future maintainers;
- `architecture.json`: graph data with `title`, `nodes`, `edges`, `flows`, and `recommendations`. Choose groups that explain this repository, rather than forcing a fixed taxonomy. Every node must contain `id`, `label`, `group`, `kind`, `purpose`, and non-empty `evidence` array. A flow has `title`, `summary`, and ordered node-id `steps`. Every recommendation must include `title`, `confidence`, `why`, and `safeValidationCommand`;
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
