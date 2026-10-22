# Fire Take Off — permanent operating instructions

## Start every session

1. Read this file, docs/PRODUCT_VISION.md, docs/ROADMAP.md and docs/CURRENT_STATE.md before development.
2. Confirm repository root and origin (TyroneBain/fire-take-off), current branch, worktree changes and relevant existing code. Read applicable nested instructions.
3. Recover verified progress from CURRENT_STATE.md and its evidence. Chat history is not permanent memory.
4. Follow the roadmap. Phase 0 must pass its exit criteria before product development begins. Document any justified roadmap or architecture change before implementing it.

## Product objective

Build an original, functional equivalent of Countfire's complete user-facing takeoff and estimating workflows, initially private for personal use. Include all required and publicly documented features in FEATURE_PARITY.md. Interface mockups do not constitute functional parity. Do not introduce unrelated products or AI designer features.

Research public documentation and normal user-visible workflows in authorised accounts. Do not extract Countfire source, decompile its bundles, bypass access controls, copy proprietary assets or infer permission from private use. REA functionality tests use our own fixture only. Never record credentials, browser profiles, customer drawings or private account data in Git.

## Engineering and verification

- Inspect code before changing architecture; preserve completed functionality and unrelated user work.
- Record major decisions and trade-offs in docs/DECISIONS.md; recommendations are not accepted architecture.
- Maintain one traceable FEATURE_PARITY entry per requirement, with source, workflow, status, acceptance tests, limitations and priority. Discoveries expand the inventory; unknowns remain explicit.
- Allowed feature states: NOT STARTED, IN DEVELOPMENT, IMPLEMENTED, TESTED, VERIFIED, BLOCKED. VERIFIED requires relevant passing acceptance tests and recorded evidence, environment and date. Do not promote statuses based on documentation, installation or mocks.
- Test meaningful behavior and failure cases. Never claim functionality, installation, MCP access, commits or pushes succeeded without observing evidence.
- Keep docs/TEST_STRATEGY.md and known limitations current. Do not confuse REA doctor success with live MCP analysis.
- Exclude credentials and private drawings/data. Use synthetic or explicitly licensed fixtures with provenance. Keep the GitHub repository private; do not publish or change visibility.
- Commit verified changes with meaningful messages and push authorised completed work to the existing repository; never force-push, discard unrelated changes or overwrite a changed remote head.

## Durable handover after every meaningful session

Update docs/CURRENT_STATE.md before committing: exactly what is finished, incomplete, broken/blocked, tests actually run, evidence paths, architecture/roadmap changes, current branch/commit references, remote delivery state and the next executable task. Keep FEATURE_PARITY, ROADMAP, DECISIONS and REA_SETUP consistent. Record failed checks as well as successes. If publication is blocked, preserve all local work and exact recovery steps. Report observed results without inventing completion.

## REA

Read docs/REA_SETUP.md before changing REA. Follow the official morluto/rea documentation, inspect exact setup plans, preserve unrelated Codex configuration, and install no optional native applications without approval. Pin the tested version. Verify registration, matching instructions, official Codex health checks and an actual owned-fixture analysis separately. An absent live REA tool catalog remains an unresolved Phase 0 requirement even when the CLI works. After a required restart, verify tools inside that new session before lifting the Phase 0 gate.
