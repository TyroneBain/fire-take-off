# Current verified state — durable handover

Last meaningful session: 2026-10-22 (Australia/Sydney). Phase 0 COMPLETE. Phase 1 IN DEVELOPMENT. No replacement application has been implemented; all 71 product requirements remain NOT STARTED.

## Repository and delivery

Root `/Users/tyronebain/Projects/fire-take-off`; branch `main`; origin `https://github.com/TyroneBain/fire-take-off.git`. Session began clean at `53de3e8580c3a8d003c9ae6f75bd915dd29c760b`, the published live-MCP/corpus foundation commit. Local/remote SHA and tree matched after prior API publication. Repository visibility was confirmed PRIVATE with authenticated push permission. Shell Git reached GitHub only outside sandbox, then failed for unavailable credentials. Use the GitHub connector with expected-head protection; do not claim shell push works.

This session's verified batch is prepared for API delivery using that parent. Its final SHA is available through `git log -1` after publication/reconciliation; verify the remote ref. If delivery fails, preserve all files/index, create a tree from these changed paths over the parent tree, create the commit, update main with expected SHA, and reproduce exact commit/tree objects locally. Never overwrite a changed remote head.

## Completed and observed

- Read AGENTS, vision, roadmap and prior state; confirmed root/origin/main and clean worktree. No nested AGENTS files.
- REA 6.7.0 live MCP verification already passed in this fresh session: aligned workflow 42, actual owned-fixture analysis, seven source checks and 3/3 Node behavior tests. Evidence: `docs/evidence/rea-live-mcp-2026-10-22.json`; prior Terminal recovery separately recorded. No REA repair or third-party analysis performed in this follow-up.
- Added Apple PDFKit independent inspection/render script and corpus derivation script. Original vector and raster renders visually show the six symbols/run/area/zone. Rotated media box now renders fully after fixing the initial clipped viewport. Crop metadata checked separately.
- Derived/reopened 10/100-page repeated vector PDFs; all page dimensions checked. Generated a revision with six symbols but one removed, one added and five unchanged. Malformed PDF exits 1; unsupported generator variant rejects before writing output. Evidence/digests/environment: `docs/evidence/drawing-corpus-2026-10-22.json`.
- Public help centre is accessible in Chrome. Read eight articles for zones/order, scale, false positives, reclassification, workbook layout, itemisation and checking outputs. `docs/REFERENCE_RULES.md` records sources/dates/rules/unknowns. Added F062–F071 and acceptance cases A012–A016. Earlier 61-entry reports remain historical.
- Created unassigned reference project `Fire Take Off synthetic research 2026-10-22`, takeoff `Rev 0`, empty discipline `Synthetic fixture`. Successful creation and disabled empty export observed. Scratch content retained; no unrelated project edited and no assignments/messages sent.
- Attempted normal Upload with our original PDF. Chrome tool rejected its path as outside configured workspace roots. No upload/count/measure/export happened. Private IDs/URLs, account data and third-party assets are not committed.

## Checks and limitations

Swift 6.3.3, x86_64 macOS 26.7.1 (25G241); Apple PDFKit/AppKit already installed. Both research scripts compiled and ran. Corpus metadata, revision-coordinate and invalid-input checks passed. Base structural checks and Node smoke tests are earlier evidence, not product functionality. No product acceptance cases have run.

Observed diagnostics: CoreGraphics PDF message during derivation and restricted sysctl message from framework; outputs subsequently reopened successfully. Shell hardware sysctl and piped ps were denied. No hardware budget is inferred from those failures. Search returned no relevant help results; direct web fetch failed, but Chrome read the public pages normally.

The rotated oracle renders the media box; crop viewport fidelity remains untested. Repeated-page fixtures have trivial geometry and are not representative construction or trade corpora. No timings/memory budgets are measured or accepted. Article text specifies documented behavior, not actual beta numerical results. Six-to-six revision oracle prevents aggregate-only validation.

## Architecture and roadmap

No product stack adopted. ADR-0007 selects installed PDFKit only as an independent research oracle. Recommendations in ARCHITECTURE remain unaccepted. Full takeoff/estimating, cloud/collaboration and integrations scope remains intact. Original implementation only; no Countfire source, bundles, models or proprietary assets extracted.

Phase 1 still needs P0 controlled drawing workflows, boundary/tie/correction/revision policies, representative small/medium/large vector/raster sets, hardware measurements and accepted tolerances/budgets, and stack ADR. Remaining discovered help articles also need full specification. Phase 2 remains gated.

## Next executable task

Read the remaining public takeoff/export/import articles and specify multipliers, Ignore behavior, floating references and symbols-removed records. Resolve the Chrome upload tool's workspace configuration through its supported access mechanism before uploading the owned fixture; do not bypass the rejection. Then execute scratch import/count/correct/scale/measure/zone/export and record sanitised results. Extend boundary and realistic drawing fixtures and benchmark candidate renderers before adopting a stack.

## Evidence index

- `docs/evidence/rea-live-mcp-2026-10-22.json`: live identity, seven source checks, behavior tests and semantic limitations.
- `docs/evidence/rea-terminal-recovery-success-2026-10-22.json`: earlier setup/doctor/CLI success; historical failed installation/analysis/recovery records remain alongside it.
- `docs/evidence/drawing-fixture-checks-2026-10-22.json`: original PDF byte checks.
- `docs/evidence/drawing-corpus-2026-10-22.json`: this session's rendered/derived corpus checks and known limits.
- `docs/evidence/countfire-ui-observations-2026-10-22.json`: earlier 21-entry control/navigation ledger, before any reference writes.
- `docs/REFERENCE_RULES.md`: current public sources and controlled scratch creation/upload-denial record.
- `docs/WORKFLOW_SPECIFICATIONS.md` and `docs/ACCEPTANCE_CASES.md`: proposed requirements; none are product acceptance results.

Generated PDFs/images, raw REA bundle, local tools and reference URLs remain ignored under `.local/` or `/private/tmp`. apps/packages/tests are still placeholders; no CI workflow or product dependencies installed.
