# Authoring recipes

A recipe is declarative workflow definition. Runtime owns bootstrap, Pi process lifecycle, worker policy, Bifrost correlation, and local ledgers. Do not copy that machinery into recipe prompts.

## Where recipes live

Use either:

```text
<package>/recipes/<recipe-id>/
<target>/.pi/bifrost-patterns/recipes/<recipe-id>/
```

Bundled recipes resolve before project recipes. A project recipe therefore cannot override a bundled ID.

Minimum layout:

```text
recipes/my-recipe/
├── recipe.json
├── prompts/
│   └── orchestrator.md
└── README.md
```

## Minimal manifest

```json
{
  "id": "my-recipe",
  "version": 1,
  "status": "experimental",
  "runtime": "pi",
  "summary": "One bounded workflow.",
  "outer": {
    "prompt": "prompts/orchestrator.md",
    "model": "explicit"
  },
  "safety": {
    "automaticPromptReplay": false,
    "workerMutatingGit": false,
    "orchestratorOwnsGitIntegration": true
  },
  "acceptance": ["Observable completion condition."]
}
```

Required fields enforced by `npm run recipe:validate`:

- positive integer `version`;
- `runtime: "pi"`;
- `safety.automaticPromptReplay: false`;
- existing outer prompt.

## Optional manifest features

### Inputs

Collect bounded choices before Pi starts:

```json
{
  "inputs": [{
    "id": "scope",
    "prompt": "Discovery scope",
    "options": [
      { "value": "source", "label": "Source only" },
      { "value": "history", "label": "Source, history, and ADRs" }
    ],
    "default": "source"
  }]
}
```

CLI callers pass selections with `--input scope=source`. Every option needs string `value` and `label`.

### Preflight

Only supported deterministic capabilities are allowed:

```json
{
  "preflight": [
    { "capability": "repo-index", "output": "onboarding/repo-index.json" }
  ]
}
```

`output` must be relative and cannot traverse with `..`. Available capabilities:

- `repo-index` — paths, fingerprints, manifests, entry/test candidates, and import edges; never source contents;
- `model-inventory` — configured Bifrost tiers and model references.

### Existing Bifrost requirement

```json
{ "requiresExistingBifrost": true }
```

Use when recipe reads Bifrost configuration as evidence. Model Foundry uses this. Interactive runs offer explicit setup or exit; dry runs fail with `bifrost-pattern init` guidance. Never silently modify Bifrost configuration from a recipe.

### Selected capabilities

Recipes default to `standard` outer and standard Bifrost-routed workers. They cannot declare arbitrary tools, extensions, or execution privileges.

```json
{
  "capabilities": {
    "outer": "foundry",
    "directWorkers": {
      "bifrost-model-evaluator": "answer-evaluator",
      "bifrost-model-artifact-evaluator": "artifact-evaluator"
    }
  }
}
```

Selected outer kinds: `standard`, `foundry`. Selected direct-worker kinds: `answer-evaluator`, `artifact-evaluator`. Direct worker kinds require `outer: "foundry"`; unknown kinds fail validation. `directWorkers` is not supported.

Use direct workers only for bounded evaluations requiring exact `model` selection rather than target-project routing. Direct calls require explicit model, remain side-effect bounded, and record direct routing evidence. New privileged kinds require runtime code, tests, and documentation; recipe JSON alone cannot grant them.

### Terminal cleanup

```json
{ "cleanup": { "onTerminal": "run-artifacts" } }
```

This deletes run-local artifacts when outer Pi exits. If a workflow needs cleanup while outer Pi stays open, provide explicit completion tool plus settled-turn cleanup, as Model Foundry does.

## Prompt contract

Prompt must define:

1. user problem and bounded outcome;
2. outer versus worker responsibilities;
3. consent point for provider calls, installs, Git writes, or other side effects;
4. failure policy: no automatic replay;
5. evidence required before claims or promotion;
6. terminal behavior and artifact retention/cleanup.

Repository inspection and substantive artifact work require workers. Outer only coordinates, asks questions, reviews established evidence, and integrates approved changes. Roles can be created through `bifrost_create_role`; do not hardcode provider-specific worker routing.

## Hard constraints

These are non-negotiable:

- Bifrost owns routing. Recipes do not edit `.pi/bifrost.json` temporarily or replace Bifrost behavior.
- No automatic prompt replay.
- No remote telemetry, prompt bodies, provider responses, credentials, source contents, or tool output in run feedback.
- Target project changes require explicit user approval and outer-owned integration.
- Generated role files live under `.pi/bifrost-patterns/agents/`.
- Do not add hidden installs, global installs, cloud dependencies, or automatic provider calls.
- Keep architecture/UI advice advisory. Enforce safety, evidence integrity, selected capabilities, valid paths, and valid JSON only.

## Validate

```bash
npm run recipe:validate
npm test
```

Then run recipe in disposable local project. Confirm worker routing/ledger evidence, cancellation behavior, artifact cleanup, and zero unintended target changes.
