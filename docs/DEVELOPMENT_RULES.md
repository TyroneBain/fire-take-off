# Development rules

AGENTS.md is the persistent operating contract. Recover state from version-controlled documents at session start and update it after meaningful work.

1. Keep phases measurable. Product code is prohibited until Phase 0 exits; each later phase needs its own evidence before completion.
2. Inspect before editing. Preserve user changes and prior behavior. Use small coherent commits; no force-push, hidden reset or unauthorised repository visibility changes.
3. Document architecture decisions before adoption. Separate recommendations, accepted decisions, experiments and observations. Avoid premature scaffolding or dependencies.
4. Bind requirements and tests to parity IDs. Report actual test results and unresolved limitations. VERIFIED requires behavior acceptance evidence, not only a unit test.
5. Use one canonical page coordinate system. Preserve source document identifiers, revision lineage and calibration provenance; never silently scale counts/measurements between revisions.
6. Keep generated artefacts and private input outside Git. Never commit tokens, cookies, customer drawings, proprietary bundles or browser captures containing private content. Scrub diagnostic evidence before publication.
7. Plan cancellable, bounded background work and deterministic recalculation. Manual corrections need provenance and undo behavior. Numerical policies require explicit units and rounding decisions.
8. Update CURRENT_STATE, FEATURE_PARITY, ROADMAP, DECISIONS, TEST_STRATEGY and REA_SETUP when affected. Remove stale claims, do not merely append contradictory notes.
9. Use public Countfire material and authorised normal account interaction. REA tests inspect owned fixtures only; no Countfire source extraction.
10. Record exact blocking permissions and the smallest recovery action. A connected GitHub account does not imply shell Git authentication. Installed MCP configuration does not imply tools are accessible in the active session.

Before commit: run relevant checks, inspect staged diff and sensitive-file exclusions, update handover, check remote changes, commit and deliver through an available authorised GitHub mechanism. Document delivery method honestly.
