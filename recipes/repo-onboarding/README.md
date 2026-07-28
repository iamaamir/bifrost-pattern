# Repo onboarding

Human-first, evidence-backed repository orientation.

```text
scope gate
  → parallel read-only architecture / domain / runtime workers
  → outer synthesis
  → private drafts + interactive graph
  → explicit project-document promotion gate
```

## Run

```bash
npx bifrost-pattern repo-onboarding
```

Before Pi opens, runner asks for one discovery scope (or pass `--input discoveryScope=<value>`):

- **source only** — default, lower cost;
- **source + git history + ADRs** — adds rationale and evolution evidence.

## Drafts

Drafts remain in run-local `.pi/bifrost-patterns/outer-runs/<run-id>/onboarding/` until approved:

```text
onboarding.md
CONTEXT.md
architecture.json
architecture.html
architecture.md
```

`architecture.html` is static and dependency-free. It opens locally, supports keyboard navigation, and reveals each node's source evidence. `architecture.md` contains Mermaid fallback.

## Promotion

Outer asks before it creates or updates any project documentation:

```text
docs/onboarding.md
CONTEXT.md
docs/architecture.html
docs/architecture.md
```

Facts carry relative source paths. Recommendations carry confidence, reasoning, and validation command.
