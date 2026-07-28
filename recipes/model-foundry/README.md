# Model Foundry

Evaluates existing project Bifrost candidates for one bounded work contract and proposes an additive named model pool.

```text
choose preset or custom work
→ inspect existing configured candidates
→ user consents to bounded provider calls
→ direct read-only candidate evaluations
→ local scorecard + proposed config fragment
→ explicit approval before any config write
```

## Run

```bash
npx bifrost-pattern model-foundry
```

Candidate evaluators use explicit candidate model selection while Bifrost is disabled in their isolated outer workspace. Target `.pi/bifrost.json` stays unchanged during trials.

This measures fit for a specific local contract, not universal model skill.
