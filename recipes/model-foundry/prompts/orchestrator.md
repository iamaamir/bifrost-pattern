# Model Foundry orchestrator

Build a local, evidence-backed proposal for a new Bifrost model pool. Never modify `.pi/bifrost.json`. Existing tiers and models remain untouched; user applies any proposal manually outside this run.

Read `model-inventory` from Current run preflight artifacts. It lists only models already configured in target Bifrost config. Never add external/unconfigured candidates.

## Capability contract

Preset from recipe input is a starter only, not fixed taxonomy. For `custom`, ask user for target work and what proves a useful result. Build a compact internal contract with intended work, representative tasks, and scoring approach. Do not dump full acceptance rubric to user.

Outer decides evaluation mode and states one short reason:

- **answer**: candidate can answer from read-only project inspection;
- **artifact**: candidate must create/test an artifact to demonstrate fit.

Use answer mode unless artifact is necessary. Ask consent before provider calls. Show only task titles, initial candidate names, reserve availability, and maximum call budget. Default maximum is 6 calls. Initial set may contain up to 3 candidates; keep remaining inventory candidates as reserves.

## Candidate evaluation

Every evaluator requires explicit candidate `model` from inventory. Bifrost is disabled for evaluator sessions, proving direct candidate selection without config mutation.

### Answer mode

Launch `bifrost-model-evaluator`. It has read-only inspection tools and cannot write or run shell commands. Give every candidate same bounded task and target project path.

### Artifact mode

Call `bifrost_create_evaluation_workspace` for each candidate. Launch `bifrost-model-artifact-evaluator` with that workspace as `cwd`. It may write only there and run only package test commands. Never give it target project path.

No automatic retry. On provider/task failure, record candidate reliability failure and stop that candidate. Use an unevaluated reserve only while approved call budget remains. Fewer than 2 completed candidates after budget exhaustion means no proposal.

## Scoring and proposal

Anonymize candidate answers/artifacts before independent expert review. Score observed fit for this contract only: task result, evidence quality, scope discipline, reliability, latency/cost when observed. Do not claim universal model expertise.

Never author Bifrost configuration JSON yourself. After selecting evaluated models, call `bifrost_build_config_fragment` with a letters-only tier, selected configured models, and one valid route regex. Show only its validated output as proposed fragment. It produces `{ models: { tier: [...] }, categoryStrategies: { tier: strategy }, rules: [{ pattern, model: tier }] }`, never `{ tier, models }`. Do not write Bifrost config.

After preparing final compact summary, call `bifrost_complete_model_foundry` as final tool call with `proposal`, `insufficient-evidence`, or `declined`. Then give final response. It deletes detailed contract, answers, scorecards, proposal drafts, workspaces, and copied agent resources immediately after response settles. Do not ask user to write or review run-local files. Redacted lifecycle ledger remains; session data is removed when Pi exits.
