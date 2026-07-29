# Build plan

## Product boundary

Bifrost Pattern is local-first workflow runtime on Pi-Bifrost and Pi-subagents. Bifrost routes turns; Patterns owns recipe execution, evidence, run artifacts, lifecycle records, and cleanup.

Non-negotiable:

- no automatic replay, remote telemetry, hidden installs, or provider calls without consent;
- target project and `.pi/bifrost.json` remain unchanged unless user explicitly approves;
- Model Foundry never mutates target project during evaluation;
- privileged behavior uses curated runtime capability kinds, never arbitrary recipe-declared tools;
- detailed Foundry evidence is terminal-cleaned; redacted lifecycle evidence remains.

## Completed

- Bifrost bootstrap/init, Pi-subagents bootstrap, declarative bundled/project recipes.
- Fixed outer with Bifrost-routed worker topology and generated bounded roles.
- Repo onboarding: cached structural index, AST enrichment, graph, review loop.
- Model Foundry: configured-model evaluation, disposable artifact workspaces, validated config fragments, terminal cleanup.
- Curated capability plan: standard/foundry outer and answer/artifact evaluator worker kinds.
- PatternStore: central Pattern-owned storage under `.pi/bifrost-patterns/`, scoped cleanup, safe artifact identifiers, atomic profile writes.
- Release pipeline: validation, version/tag/push, npm publish, GitHub release, registry confirmation.
- Run dashboard baseline: canonical redacted run report projector, configurable built-in terminal fields, fzf/numbered run picker, direct/latest selection, active indicator, watch refresh.

## Current state

- GitHub `main`: `34de034` — Pattern artifact ownership hardening.
- npm latest: `0.2.2`; current fixes are not yet published.
- Validation: 37 tests, 3 recipe validations, 4 delegation scenarios passing at `34de034`.

## Next steps — 2026-07-29

1. Release `0.2.3` — publish pushed PatternStore/profile fixes.
2. Extend dashboard evidence — capture trustworthy token usage and richer active worker lifecycle evidence in redacted ledger; add HTML/SVG renderer adapters over canonical run report.
3. Add deterministic fake-provider E2E — outer → worker → Bifrost route → terminal ledger → cleanup acceptance.
4. Centralize validated runtime context — replace repeated `BIFROST_PATTERN_*` environment parsing across extensions.
5. Add redacted onboarding phase/review lifecycle events.
6. Run real consented Model Foundry evaluation against configured providers.

## Deferred

- Split `run-pattern.mjs` into deeper lifecycle modules after dashboard evidence contract is designed.
- Tighten artifact evaluator command policy after deciding whether disposable evaluations may have network/external side effects.
