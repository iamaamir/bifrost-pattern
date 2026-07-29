# Bifrost Pattern

Local-first workflow runner for [Pi-Bifrost](https://github.com/iamaamir/pi-bifrost) and [Pi-subagents](https://www.npmjs.com/package/pi-subagents).

Bifrost remains routing primitive. Pattern owns orchestration, worker lifecycle, local evidence, and task-specific role creation.

## Install

```bash
npm install -g bifrost-pattern
```

`init` explicitly installs/configures Pi-Bifrost when needed. Workflow runs bootstrap Pi-subagents project-local when absent. Both stop when extension exists in both user and project scopes.

## Initialize Bifrost

For a project without Bifrost:

```bash
bifrost-pattern init [project-path]
```

Fresh setup explicitly asks before project-local install and optional provider probing, then opens interactive Pi in target project. Existing valid setup is left unchanged and opens Pi directly.

```bash
bifrost-pattern init . --no-open  # setup/validate without opening Pi
bifrost-pattern init . --probe    # explicitly refresh provider probe
```

## Run

From target project:

```bash
bifrost-pattern fixed-orchestrator-workers [project-path]
```

If Bifrost setup is missing, workflow asks before setup. It then asks for fixed outer `provider/model`; choice is saved in target `.pi/bifrost-patterns/profile.json`.

```bash
bifrost-pattern repo-onboarding . --input discoveryScope=source-only
bifrost-pattern model-foundry . --input specialization=testing
bifrost-pattern fixed-orchestrator-workers . --orchestrator-model provider/model
```

Use `--dry-run` to inspect launch command without starting Pi.

## Run dashboard

```bash
npx bifrost-pattern@latest        # pick recipe
npx bifrost-pattern@latest --help # usage
bifrost-pattern runs              # recent-first fzf picker; numbered fallback
bifrost-pattern runs latest       # newest run
bifrost-pattern runs <run-id>     # exact run
bifrost-pattern runs --watch      # refresh active run view; q/Esc/Ctrl+C exit
```

Dashboard reads redacted local ledgers only. Configure built-in field order in `.pi/bifrost-patterns/dashboard.json`:

```json
{ "fields": ["recipe", "outcome", "outerModel", "workers", "tokens"] }
```

Token usage appears only when recorded by trusted host evidence; otherwise it shows `unavailable`.

## Model

```text
fixed outer orchestrator
  └─ task-shaped Pi-subagent workers
       └─ target-project Bifrost routing
```

Outer estimates scope, uncertainty, mechanical effort, risk, and parallel value. Repository inspection and substantive artifact work require 1/2/N workers; outer directly handles only conversation, coordination, and integration of established evidence.

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

## Recipes

```bash
npx bifrost-pattern fixed-orchestrator-workers
npx bifrost-pattern repo-onboarding
npx bifrost-pattern model-foundry
```

`repo-onboarding` creates human guide, `CONTEXT.md`, and accessible interactive HTML/Mermaid architecture-graph drafts. Before Pi opens, runner asks whether to include git history/ADRs; Pi then starts work immediately. It builds a local, cached deterministic repo index so workers target evidence files rather than dump source trees. It asks again before promoting drafts into project docs.

`model-foundry` evaluates only models already present in project Bifrost config against a user-selected or custom work contract. If setup is missing, it offers explicit setup or exit. Candidate work is read-only unless outer selects isolated disposable artifact evaluation. It emits validated additive config fragment, never writes Bifrost config, and removes detailed evaluation artifacts after completion.

## Add a pattern

Recipes are declarative folders: `recipe.json`, `prompts/`, `scenarios/`, and `README.md`. Runtime bootstrap, worker lifecycle, routing correlation, and ledger stay in core runner.

Resolution order:

```text
bundled recipes
→ .pi/bifrost-patterns/recipes/<recipe-id>/
```

A project recipe needs a positive integer `version`, `runtime: "pi"`, `safety.automaticPromptReplay: false`, and an `outer.prompt` Markdown file. Recipes may declare select inputs; runner collects them before Pi starts. Pass values noninteractively with `--input name=value`.

Recipes default to standard outer/worker capabilities. Only selected runtime kinds may grant privileged behavior: `foundry` outer, `answer-evaluator`, and `artifact-evaluator` direct workers. Recipe JSON cannot grant arbitrary tools, extensions, model bypasses, or workspace writes.

## Validation

```bash
npm test
npm run recipe:validate
npm run delegation:validate
```

## Release

Release from clean `main`. Script validates tests and recipes, bumps version, commits/tag/pushes, publishes npm, creates GitHub release, then confirms registry version.

```bash
npm run release -- --patch --publish
npm run release -- --minor --publish
npm run release -- --major --publish
```

See [`docs/delegation-tuning.md`](docs/delegation-tuning.md) for local effort-tuning loop.

## Documentation

- [Recipe authoring](docs/recipe-authoring.md) — manifest, prompt, safety, validation, and lifecycle constraints.
- [Architecture](docs/architecture.md) — runtime topology, ownership boundaries, evidence, cleanup, and safety model.
- [Repo memory + bootstrap](docs/repo-memory-bootstrap.md) — graph-first bootstrap, durable repo memory, token savings, and worker handoff.
