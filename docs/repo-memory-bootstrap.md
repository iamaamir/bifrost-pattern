# Durable repo memory and graph-first bootstrap

This doc is a design target for orchestration recipes that need to spin many sub-agents without paying the same discovery tax repeatedly.

It complements:
- `docs/recipe-authoring.md` — recipe contract and safety rules
- `docs/architecture.md` — runtime boundaries and evidence model
- `recipes/fixed-orchestrator-workers/README.md` — current fixed orchestrator shape

## Problem

Big token loss comes from three repeats:

1. repeat repo discovery
2. repeat search/read loops
3. repeat reasoning about known facts

If every worker starts cold, each one re-derives the same repo map, test targets, entrypoints, gotchas, and affected files. That is waste.

## Goal

Make 1 agent do expensive discovery once, then feed every later worker a small, durable, SHA-aware context pack.

## Recipe mapping

`fixed-orchestrator-workers` now seeds a preflight `repo-index`, builds a small graph-first task pack, and hands thin workers exact slices instead of a cold repo tour.

## Non-goals

- No hidden replay
- No per-agent full repo scan
- No source-code dumping into memory
- No provider-specific hardcoding
- No memory that can outlive its evidence

## Design rules

- **Graph first, text last**
- **Exact lookup before semantic lookup**
- **One discovery pass per HEAD, unless freshness/invalidation trips**
- **Store claims, not transcripts**
- **Reuse artifacts, do not recreate them**
- **Invalidate by diff, not by vibes**
- **Workers stay thin; outer orchestrator owns memory merge**
- **Token saving is a constraint, not a success condition**

## Quality-first policy

Token savings matter only after correctness and freshness pass. A run that is cheap but wrong is a failure. A run that is expensive because hard evidence was required can still be a success.

## What to persist

| Layer | Store | Owner | Update rule | Token win |
| --- | --- | --- | --- | --- |
| Repo map | entrypoints, module tree, key symbols, test targets | scanner | refresh on HEAD or structural diff | kills repeat discovery |
| Decision log | why choice was made | orchestrator | append on accepted decision | kills re-debate |
| Gotcha log | recurring failure mode + first check | reviewer/scanner | append when proven | kills repeat bugs |
| Artifact index | test logs, command output, diffs, traces | runner | append by artifact id | kills reruns |
| Task pack | current task, relevant paths, symbols, commands | orchestrator | rebuild per task | kills broad context |
| Graph index | AST, import, call, symbol, file graphs | scanner | incremental on changed files | kills grep storms |

## Memory record shape

Keep every durable item small and evidence-backed.

| Field | Meaning |
| --- | --- |
| `id` | stable key |
| `kind` | decision, gotcha, finding, task, reference |
| `claim` | short human-readable statement |
| `evidence` | commit SHA, file paths, symbol names, artifact ids |
| `scope` | repo area or module |
| `freshness` | active, stale, superseded, needs-review |
| `updated_at` | last verified time |

## Bootstrap pipeline

### 1) Cheap repo pass

Harness or outer orchestrator gathers:
- `git sha`
- dirty paths
- changed files since last known memory
- top-level tree
- recent commits
- any cached artifact ids

This pass must be cheap. It should not read the whole repo body.

Cold start rule:
- if graph/index missing, build it first
- if graph/index stale, rebuild impacted slice then hand off
- if rebuild fails, fall back to exact path reads for only task-scoped files

### 2) Structural index query

Use prebuilt structure to answer:
- where are entrypoints?
- what modules own this feature?
- what tests cover this area?
- what symbols call / are called by this symbol?
- what files changed together?

Lookup precedence:
1. exact path
2. exact symbol + signature
3. namespace/module-qualified symbol
4. graph neighborhood
5. semantic search

If names collide, prefer path + signature over raw symbol text.

Preferred sources:
1. exact path
2. exact symbol
3. graph neighborhood
4. semantic search
5. file read

### 3) Context pack build

Return a tight pack with only what later workers need:
- task statement
- current SHA
- graph snapshot id / index sha
- relevant files
- relevant symbols
- known gotchas
- test commands
- artifact ids
- freshness warnings

### 4) Thin worker handoff

Worker gets the pack and only opens exact slices.
No worker should do a fresh full-repo orientation unless the pack is stale or incomplete.
If the pack is stale, orchestrator refreshes the impacted slice, not whole repo.

## AST / graph layer

This is the main bootstrap engine.

### Index kinds

- **AST index** — functions, methods, classes, signatures, nesting, tests
- **Import graph** — module boundaries and dependency flow
- **Call graph** — execution path and impact radius
- **Symbol graph** — named entities and references
- **File graph** — path hierarchy and module ownership
- **Change graph** — files that change together, plus affected neighborhoods
- **Doc graph** — decisions, gotchas, and canonical pointers

### Rebuild contract

Reindex impacted slices when any of these happen:
- file add/remove/rename/move
- signature change
- import change
- call edge change
- symbol ownership change
- graph snapshot version change

Keep old snapshots only as historical evidence, not as active guidance.

### What graph answers well

- “Where start?”
- “What is the impact of this file change?”
- “Which test is closest?”
- “What symbols should worker read?”
- “What module owns this behavior?”

### What graph does not replace

- full source reading for exact patching
- tests for verification
- human judgment for ambiguous design calls

## Invalidation rules

Use deterministic freshness checks.

### Invalidate memory when:
- repo HEAD changes and memory is HEAD-scoped
- any referenced file hash changes
- any referenced symbol changes
- test result artifact is superseded
- a later decision explicitly replaces an older one

### Status values

| Status | Meaning |
| --- | --- |
| `active` | trusted for current HEAD |
| `needs-review` | probably okay, but diff touched scope |
| `stale` | evidence no longer current |
| `superseded` | replaced by newer claim |
| `historical` | keep for trace, not for guidance |

## Orchestration roles

Use role split to stop same agent doing all discovery.

| Role | Job | Must not do | Write authority |
| --- | --- | --- | --- |
| Scanner | build repo map, graph, cache, gotcha list | patch code | repo map, graph index, artifact index |
| Planner | turn task into small work slices | redo repo discovery | task pack only |
| Worker | touch exact files and symbols | broad search loops | code diff only |
| Reviewer | validate claims and stale boundaries | invent new design | review notes only |
| Orchestrator | merge evidence and decide next slice | trust unverified memory | decision log, gotcha log, task pack |

## Token-saving moves

### 1. Stable prefix cache

Keep reusable context at front:
- repo policy
- memory contract
- repo map
- task pack template

Keep volatile task details later.
If provider cache exists, treat stable prefix reuse as a manual assumption until validated by provider evidence.

### 2. Delta-only outputs

Workers return only:
- changed facts
- changed files
- test result delta
- new gotchas
- new evidence ids

### 3. Compress after retrieval

Compress long tool output or retrieved docs.
Do not compress source truth.

### 4. Reuse artifacts

If test output already exists, cite artifact id.
Do not rerun unless stale.

### 5. Exact-first search

Exact path/symbol hits are cheaper and safer than semantic rummaging.
Use semantic search only when exact lookup misses.

### 6. Keep search local

Search should start from:
- current task
- recent decisions
- relevant graph neighborhood

Do not fan out across whole repo by default.

## Bootstrap queries to support

The system should answer these cheaply:

- What changed since last known good state?
- What is the smallest file set for this task?
- What tests prove the slice?
- What prior decision already settled this?
- What gotcha should worker remember before editing?

## Recommended artifact pack

A good bootstrap pack can be plain markdown or JSON.

| Item | Example |
| --- | --- |
| `git_sha` | current commit |
| `git_branch` | current branch |
| `task` | current objective |
| `dirty_paths` | changed files |
| `entrypoints` | start files |
| `relevant_modules` | module names |
| `relevant_symbols` | functions/classes |
| `gotchas` | known traps |
| `tests` | exact commands |
| `artifact_ids` | prior logs/traces |
| `freshness` | active/stale markers |

## Expert loop

For hard tasks, use three expert passes.

1. **Memory expert** — what should persist?
2. **Graph expert** — what structure should bootstrap query?
3. **Orchestrator expert** — what should be delegated vs merged?

Then run one reviewer pass to kill overclaims.

## Failure modes

| Failure | Symptom | Fix |
| --- | --- | --- |
| Every worker re-scans | huge token burn | centralize discovery |
| Memory is too big | prompt bloat | store claims + evidence only |
| Semantic search first | wrong-but-plausible hits | exact-first policy |
| No freshness check | stale advice | SHA + hash invalidation |
| No artifact reuse | repeated tests | artifact ids + status |
| Too many roles | orchestration drag | keep scanner/planner/worker/reviewer |

## Evaluation

### Metrics block

Record one small block per run:

| Metric | Capture | Why it matters |
| --- | --- | --- |
| `tokens_per_task` | outer + worker tokens | main cost signal |
| `repeated_file_reads` | duplicate file opens / reads | repeat-work detector |
| `repeated_search_calls` | grep / symbol / semantic queries repeated on same slice | orientation waste detector |
| `cache_hit_rate` | repo-index / graph / artifact reuse hits | amortization signal |
| `stale_catches` | times freshness rules blocked bad reuse | safety signal |
| `artifact_reuse_rate` | reused logs / test outputs / traces | avoid reruns |
| `worker_count` | workers launched | orchestration overhead |
| `time_to_first_useful_slice` | first exact file/symbol hit | bootstrap efficiency |

### Suggested baseline row

| Run | tokens/task | repeated reads | repeated searches | cache hits | stale catches | artifact reuse | workers | time to first slice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | high | high | high | low | n/a | low | many | slow |
| graph-first | lower | lower | lower | higher | tracked | higher | fewer | faster |

### Run verdict

Keep a short verdict line after each real run:
- `saved_tokens`: rough delta vs baseline
- `saved_reads`: repeated reads removed
- `saved_searches`: repeated searches removed
- `reuse_wins`: artifacts or cache reused
- `risk_note`: any stale-memory or graph-freshness issue
- `quality_gate`: pass/fail on correctness and freshness

Never call a low-token run successful unless the quality gate passed.

Success means:
- fewer cold starts
- fewer repeated reads
- smaller worker context
- same or better correctness
- clear stale detection
- measurable token savings on discovery-heavy jobs

## Rollout plan

### Phase 1
Write repo map, gotchas, decisions, and artifact index.

### Phase 2
Add AST/import/call graph bootstrap and exact lookup.

### Phase 3
Add task packs, delta-only worker outputs, and stale checks.

### Phase 4
Measure token use, repeated work, and cache reuse.

## Bottom line

Best recipe is not “smarter workers.”
Best recipe is: **one strong bootstrap, durable structural memory, thin workers, and hard freshness rules**.

That is where big token savings come from.

## Research anchors

- Aider repo map
- Tree-sitter incremental parsing
- Codebase-Memory graph bootstrap
- repo-local memory systems like repo-memory-mcp and Agents Remember
- MemGovern for curated experience cards
- prompt caching for stable prefixes
- LLMLingua-style compression for retrieved text only
