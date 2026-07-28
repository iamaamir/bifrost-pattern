# Delegation tuning

Tune orchestrator behavior from outcomes, not task-name rules.

## Loop 1: local evidence

Each run ledger records worker role, terminal state, duration, and correlated Bifrost route. It excludes prompts, responses, credentials, file contents, and tool output.

## Loop 2: scenario corpus

`scenarios/delegation.json` defines attribute-based cases and acceptable worker-count/role ranges. It is a regression target for prompt and model experiments, not a runtime router.

Validate structure:

```bash
npm run delegation:validate
```

## Loop 3: human verdict

Record only a redacted verdict per run using `schemas/delegation-feedback.schema.json`:

```json
{
  "runId": "…",
  "verdict": "too_many",
  "notes": "optional, max 500 chars"
}
```

Use repeated verdicts plus ledger outcomes to revise effort guidance. Change prompt guidance before adding safety guardrails. Safety remains only for irreversible operations and worker isolation.
