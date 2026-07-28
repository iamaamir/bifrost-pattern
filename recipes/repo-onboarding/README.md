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

## Token-efficient discovery

Before Pi starts, recipe builds local `.pi/bifrost-patterns/cache/repo-index.json` and copies compact run-specific index into drafts. Index contains hashes, paths, language/directory counts, selected manifest metadata, entry/test candidates, and bounded import edges—never source contents. If already installed, `sg` or `ast-grep` adds capped, sanitized AST symbol outlines. When absent, runner asks before installing pinned `@ast-grep/cli@0.45.0` under `.pi/bifrost-patterns/tools/ast-grep`; it never changes target `package.json` or installs globally. For noninteractive consent use `--install-ast-grep`. Workers use index data to choose evidence files, then verify claims from those files.

## Drafts

Drafts remain in run-local `.pi/bifrost-patterns/outer-runs/<run-id>/onboarding/` until approved:

```text
onboarding.md
CONTEXT.md
architecture.json
architecture.html
architecture.md
```

`architecture.html` is static and dependency-free. It opens locally, renders confirmed edges between model-selected system groups, supports keyboard navigation, and reveals each node's source evidence. Runtime flows and recommendations remain separate. `architecture.md` contains Mermaid fallback.

## Promotion

Outer asks before it creates or updates any project documentation:

```text
docs/onboarding.md
CONTEXT.md
docs/architecture.html
docs/architecture.md
```

Facts carry relative source paths. Recommendations carry confidence, reasoning, and validation command.
