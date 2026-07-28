# Model Foundry

Evaluates existing project Bifrost candidates for one bounded work contract and proposes an additive named model pool.

```text
choose preset or custom work
→ outer selects answer or isolated-artifact evaluation
→ user consents to bounded provider calls
→ direct candidate trials + reserves within budget
→ anonymous expert comparison
→ summary only, then automatic cleanup
```

## Run

```bash
npx bifrost-pattern model-foundry
```

Answer trials are tool-read-only. Artifact trials run only in disposable copied workspaces with Bifrost disabled. Target project and `.pi/bifrost.json` remain untouched.

Candidate failures are not retried. Reserves may replace them only within consented call budget. Fewer than two completed candidates produces no proposal.

Detailed contracts, answers, scorecards, proposals, sessions, and workspaces delete automatically at terminal outcome. Redacted run ledger remains locally.

This measures fit for a specific local contract, not universal model skill.
