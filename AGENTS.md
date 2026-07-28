# Bifrost Patterns Lab agent guide

## Boundary

This repository composes **public Bifrost behavior**. It must not modify, fork, monkey-patch, or rely on private Bifrost internals.

- Bifrost owns model routing, reliability, preview, pin/bypass, and trace/debug surfaces.
- A pattern owns topology, prompts, role boundaries, evaluation, and local feedback.
- An orchestrator owns user intent, delegation, review, integration, and Git mutation.

Do not turn patterns into a Bifrost orchestration feature.

## Rules

- Use only documented/public Pi and Bifrost commands/configuration.
- Never claim provider prompt-cache reuse without provider usage evidence.
- Never require automatic prompt replay. Workers preserve Bifrost no-replay behavior.
- Routing intent is a tier hint (`quick`, `general`, `frontier`), never a hardcoded provider/model default.
- Keep outer-orchestrator model pinning/bypass explicit and manually verifiable.
- Store no prompt bodies, credentials, provider responses, or telemetry in run feedback.
- Mark unproven runtime behavior as a manual assumption; do not automate it until a recipe run proves it.
- Keep recipes runnable/local-first. Do not add cloud services.

## Before adding a recipe

1. State which user problem it solves.
2. Identify Bifrost public surfaces it consumes.
3. State outer agent vs worker ownership.
4. Define failure/no-replay behavior.
5. Define local feedback and acceptance checks.

## Verification

```bash
npm run recipe:validate
```

Run a manual recipe validation before claiming a pattern works.
