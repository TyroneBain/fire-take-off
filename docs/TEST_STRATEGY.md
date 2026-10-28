# Testing strategy

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

## Foundation checks

- Required files/directories exist, internal Markdown links resolve, every parity row has required fields and an allowed status.
- git diff --check, review tracked paths and git check-ignore sensitive input examples. Check repository privacy and remote head using authenticated GitHub tools.
- REA version/runtime, Codex-scoped doctor and skill alignment; actual owned JavaScript fixture analysis compared against independently known source structure. Separate CLI evidence from live MCP results.
- Fixture behavior checks validate known normal/error behavior. They do not test takeoff functionality.

Run `node --test fixtures/rea-smoke/app.test.mjs`. Analysis invocation and evidence paths are in REA_SETUP. Record actual results in CURRENT_STATE; do not count tests that were merely planned.

## Future product acceptance

Each FEATURE_PARITY ID needs workflow preconditions, observable actions/results, edge/failure cases, fixture identity and expected outputs. VERIFIED requires passing relevant acceptance tests with date, environment, command and evidence; a reviewer must be able to reproduce the claim. TESTED means tests ran, with outcome/limitations stated; it does not imply parity approval.

Use synthetic vector and raster PDFs with known symbol coordinates and independently labelled authorised real drawings. Preserve licensing/provenance in fixtures. Split recognition training/tuning and evaluation sets. Report precision/recall, false positives and misses per trade, scale, rotation and scan quality; aggregate counts alone can hide errors.

Geometry tests use independent analytic lengths/areas, rotated/cropped pages, multiple units, boundary-crossing zones and rounding edge cases. Calibrations must survive zoom/reopen and reject degenerate input. Check persistence/undo/cancellation/crash recovery and revision lineage.

Export tests parse XLSX independently and reconcile sheets, per-zone/drawing totals, price snapshots, formulas/values, currency rounding and margins against reference calculations. Check reopening in supported spreadsheet applications and safe handling of untrusted cell text.

Viewer tests combine numeric coordinate assertions, known fiducial render comparisons and user interaction, not screenshots alone. Benchmark memory and responsiveness on agreed small/medium/large datasets and record hardware; budgets are established in Phase 1, not invented here.

Private GitHub CI is configured in .github/workflows/test.yml to run locked dependency installation and the portable npm test suite on Ubuntu 24.04/Node 24.22.0. A workflow file alone is not passing CI: record observed run/job results. Browser acceptance, dependency advisory checks and native PDFKit oracle runs remain separate.

## Authenticated research follow-up — 2026-10-22

The workflow specification matrix and 21-entry sanitised UI ledger are research evidence only. No reference writes, imports, counts, measurements, exports or pricing calculations were executed. No Fire Take Off product acceptance test ran. Documentation checks cover local links, all 61 parity entries and observation-to-spec traceability; the historical foundation report retains its original 59-entry result. See `docs/evidence/research-checks-2026-10-22.json`. The unchanged owned fixture was not retested during documentation-only work.

## REA recovery helper verification

`scripts/repair-rea.sh` passed `bash -n` and an actual official `--plan-only` run with `status: planned` and empty applied actions. Full normal-Terminal recovery has not been run here. Separate actual setup/analysis retries failed and are recorded in the recovery evidence; these failures cannot be reported as successful functional tests. Live MCP analysis remains mandatory.

## Fresh-session verification — 2026-10-22

Live REA MCP analysis and seven source comparisons passed; Node behavior tests passed 3/3. See live MCP evidence. The original drawing generator ran successfully; independent byte checks validated SHA-256, xref offsets and stream length. See drawing-fixture checks evidence. No PDF rendering, reference behavior or product acceptance cases ran. A001–A011 in ACCEPTANCE_CASES.md remain proposed tests. Historical recovery-helper failures above are superseded by the successful Terminal and live MCP records.

## Original corpus and public rules follow-up

Apple PDFKit independently opened/rendered the original vector, raster and rotated media boxes; six symbols and other geometry were visually inspected. Fixed rotated output dimensions after the initial oracle clipped content. Crop metadata is verified but crop viewport fidelity remains untested. Reopened 10/100-page sets with metadata-only inspection, verified all dimensions, six-to-six revision coordinate differences, malformed-PDF failure and invalid-variant rejection. See `evidence/drawing-corpus-2026-10-22.json`. Diagnostic framework messages are retained there. No timing/memory budgets are adopted. Public source rules and A012–A016 are specifications, not product acceptance. Reference upload failed at browser path access; no reference numerical tests ran.


## Runnable local core — 2026-10-22

`npm test` runs 12 tests (9 product-core tests plus 3 owned REA-fixture behavior tests). Product tests cover persistence/reopen, invalid hierarchy/name input, corrupt/oversized/duplicate files, drawing isolation/deletion, hash tampering, coordinate round trips at four zooms/four rotations, concurrent duplicates, bounded parser concurrency and the real HTTP workflow with token/origin failures. Tests use temporary stores and original generated PDFs. Loopback tests require host permission to listen/connect in restricted Codex sessions.

Browser observation covered UI hierarchy creation, page reopen, vector/raster and rotated/cropped display, zoom/rotation and next-page navigation. Four original PDFs were imported through the actual API; this does not test the OS file picker. Screenshots were reviewed inline because MCP denied saving to the workspace path. Final browser error/warning check is clean after enabling local WebAssembly codecs. Full-corpus performance, crop/annotation interaction, crash recovery, encrypted PDFs, accessibility and multi-device operation remain unverified.

An initial test run failed on a SQL placeholder mismatch and sandbox loopback denial; the mismatch was fixed and the loopback test rerun with permission. Initial PDF inspection called the removed document.destroy API; loading-task cleanup replaced it. Raster rendering initially logged an ICC/WebAssembly CSP warning; the specific wasm policy fixed it. Record: [local core evidence](evidence/local-core-2026-10-22.json). Product states are TESTED for partial F001–F006, never VERIFIED by these limited checks.


## Persisted notes — 2026-10-22

The suite now runs 16 tests: 13 product tests and 3 diagnostic-fixture tests. Added note create/edit/delete and stale-version failure cases, page/coordinate/text validation, drawing deletion cascade, rotated/cropped anchors, the actual CSS-pointer helper and a schema-1→2 migration preserving source bytes. All passed. Browser checks exercised placement, save, cancelled edit, saved edit, zoom/rotation anchor reprojection, reload persistence, cancelled removal and confirmed removal. The viewport arithmetic check observed <0.001 CSS pixel difference after reprojection; this is not a user-approved measurement or recognition tolerance. Screenshots remain inline/local only.

A staged whitespace check on the preceding core commit found an extra blank line at the end of the newly added stylesheet; corrected in this increment. The earlier unstaged diff check did not include untracked source files, so final verification must inspect the staged diff after adding new files. Evidence: [notes](evidence/notes-2026-10-22.json). Native file-picker and unsaved-exit behavior remain untested/unimplemented respectively.

## Page metadata — 2026-10-22

Final suite: 18 passed, 0 failed (15 product + 3 diagnostic). Added page name/title validation, stale-version rejection, reopen/source/geometry/note preservation, deletion cascade, schema 1→3 and schema 2→3 migration checks. Actual HTTP metadata route also tested. Browser saved name/title, reset an unsaved title, reloaded/reopened and confirmed card/toolbar labels plus existing note. A sandbox run passed 17/18 and failed only the temporary loopback bind; the permitted rerun passed all 18. Evidence: [page metadata](evidence/page-metadata-2026-10-22.json).

Takeoff loop: `tests/takeoff.test.mjs` exercises six independently labelled glyphs plus distractor, work-budget refusal, atomic scope/source/duplicate checks, stale-review rollback, corrections/audit, calibrated analytic 50 m/100 m² and recalibration, invalid geometry, review/scale export gates, ExcelJS readback and independent Python ZIP/XML reconciliation. Full suite 27/27 passed on 2026-10-22. Browser corpus 78 matches; pointer-selected geometry differs slightly from analytic endpoints. See takeoff-loop evidence; no realistic trade precision/recall or performance acceptance yet.

Zone acceptance in tests/takeoff.test.mjs covers analytic split/conservation, priority, duplicate outlines, concavity/derived holes, edge and outside policies, validation/stale writes, cascades, migration/reopen, real authenticated HTTP and workbook columns. Final suite 34/34 (31 product, 3 diagnostics); earlier reopen whitelist and test helper failures are retained in zone evidence. Browser creation/reorder/vertex-save/cancel checks use only our corpus. Whole-outline drag, node add/remove, right-click completion and continuous preview have not passed browser acceptance.

## Additional examples and reclassification — 2026-10-23

Final `npm test`: 42/42 (39 product + 3 unchanged owned-fixture diagnostics). Eight new tests cover migration 5→6, persistence, atomic merging, correction precedence, stale source validation even for skipped duplicates, scope/version/collision failures, repeated reclassification and original identity, workbook totals/history, HTTP routes and an independently labelled two-orientation raster oracle. The raster oracle establishes 3 + 2 = 5 distinct detected instances; it is not a PDF corpus or real construction benchmark. Existing tests still include independent workbook ZIP/XML checks. Browser pointer/keyboard handler checks exercised real PDF rendering/matching, 0 added/6 skipped with corrections intact, rename/colour changes, R/Tab/Shift+Tab/number/Escape operation and workbook HTTP transport. Evidence: [count classification](evidence/count-classification-2026-10-23.json). Initial restricted run failed only three HTTP binds; permitted runs passed. Full UI/accessibility/reference acceptance remains incomplete.

## Saved example review — 2026-10-27

Final suite 43/43, including one new independent crop/rotation/scale preview rectangle case. Browser source previews contained 1008 dark pixels each, source navigation returned from raster drawing to saved original bounds, and marker operations changed six displayed overlays to zero or one without any API state difference. Heading filter and clean console checked. Evidence: [example review](evidence/example-review-2026-10-27.json). Missing-source fallback, large-project preview latency and source-element hiding remain unverified/unimplemented as recorded.

## Navigation — 2026-10-27

43/43 suite passed after extending viewport tests with client-coordinate conversion. Browser verified pointer-anchor drift <0.36 CSS pixels per axis on vector and cropped/rotated fixtures, exact 80×60 pan delta with manual-count placement armed and entire API state unchanged, Space+tool chords without Add-to-current interference, typing/blur behavior and page switch during pending zoom. Physical trackpad/touch and edge-clamping acceptance remain open. Evidence: [navigation](evidence/navigation-2026-10-27.json).

## Measurement editing — 2026-10-27

48/48 suite passed (45 product + 3 unchanged fixture diagnostics). Added identity/reopen and exact quantity edits, invalid/stale/scope-safe updates, zone/workbook reconciliation, node projection and authenticated HTTP acceptance. Browser right-click/edit, node insertion/removal, endpoint drag, Cancel full-state equality, renamed Save and space-pan isolation passed with clean console. Browser prior pointer calibration yields 59.987901 m; independent domain geometry yields exactly 60 m. Evidence: [measurement editing](evidence/measurement-editing-2026-10-27.json).

## CI setup — 2026-10-27

ADR-0017 adds push/PR/manual automation with exact action commit pins and read-only repository permission. YAML parse and structural/pinning checks passed locally. Initial validator used Ruby filter_map, unavailable in system Ruby; changed to map.compact and reran successfully. Local product suite remains 48/48 from the measurement increment. Hosted installation and tests passed in run 40461405478/job 122046656220 at commit 83d67e0: 48/48, Ubuntu 24.04, Node 24.22.0, npm 11.19.1, Python 3.12.3. Evidence [CI](evidence/ci-2026-10-27.json). Existing dependency deprecation notices remain; this run did not execute npm audit.

## Selection count multipliers — 2026-10-27

54/54 tests passed (51 product + 3 diagnostic). Six new cases cover mixed factors and manual marks, correction/reclassification, validation/stale edits, forced audit-write rollback, schema-6 ambiguous-origin migration and failed attribution rollback/reopen, zone/XLSX reconciliation and HTTP mutations. Browser migration preserved 78 instances, real matching across 13 owned pages linked all 78 without additions, x6 yielded 468/heading totals 462+6, export returned 200, and x1 restored 78 with audit retained. Evidence: [count multipliers](evidence/count-multipliers-2026-10-27.json). Interrupted pre-restart test results were not claimed; fresh suites passed.

2026-10-28: 61/61 local tests (58 product + 3 fixture diagnostics). Seven new tests in tests/quantity-multipliers.test.mjs exercise independent length/zone arithmetic, cross-drawing/default-one scope, stale/invalid mutations, forced audit rollback, schema migration, recalibration/reopen, HTTP gates and workbook XML quantities/styles. Browser cancellation/restoration and clean console recorded in evidence/quantity-factors-2026-10-28.json. Hosted result pending this increment; prior count-multiplier CI passed 54/54.

2026-10-28 project acceptance: 67/67 local, six new tests in tests/projects.test.mjs for lifecycle/source preservation, invalid/stale mutations, forced persistence rollback, scopes/sorting, schema 8 migration and real HTTP. Browser form/scopes/filter/status/archive/restore checks and original-data preservation are recorded in evidence/projects-2026-10-28.json. Exact reference visual and accessibility parity are not established by these checks.

2026-10-28 editor follow-up: unchanged 67-test regression suite passed; browser acceptance verifies whole-page fit, all five panel placements, stable pointer zoom, manual-mode space pan with exact unchanged state, cropped/rotated note positions and dashboard return. CSS specificity and keyboard-target failures were fixed and rerun; see evidence/drawing-workspace-2026-10-28.json. No CSS mock tests or full-parity claim.

2026-10-28 comparison: 70/70 local tests pass, including independently specified original/revision change regions rendered through PDF.js, equal symbol totals with different positions, self-comparison, translation and bounds. Browser Save/Cancel/Escape/0, exact reset pixels, zoom/pan/tool/lifecycle checks preserve full API state. Renderer pixel totals are not recognition counts. Evidence: [comparison](evidence/comparison-2026-10-28.json). Real-world alignment/contrast/performance corpus remains open.

2026-10-28 overlays: 72/72 local; tests/overlay.test.mjs checks alpha/white-paper source-over behavior and actual cropped/rotated PDF placement under drag/zoom, plus invalid input rejection. Browser multi-layer isolation, keyboard/drag save/cancel, transparency/visibility, tool switching, duplicate prevention and cancelled-load cleanup preserve complete API state. First run 71/72 failed from wrong generated filename, corrected before final pass. Evidence [overlays](evidence/overlays-2026-10-28.json). Eight-layer exhaustion/real construction sheets and reference blending parity remain unverified.

2026-10-28 drawing picker: 74/74 local suite. Tests isolate duplicate labels by IDs, reject stale descendants after parent changes and handle empty scopes without source mutation. Browser both Layout pickers verify ancestor/page resets, empty project disabled submission, page validation, successful source render and unchanged API state; evidence [drawing picker](evidence/drawing-picker-2026-10-28.json).

2026-10-28 floorplans: 81/81 local tests pass. Seven tests in tests/floorplans.test.mjs cover persistent membership and positions, unchanged sources/quantities/workbook digest, validation/concurrency/group/scope safety, audit rollback including source-record deletion, singleton cleanup, migration, analytic rotated bounds and HTTP gates. Browser validates saved/cancelled positioning, reload/member navigation, same-PDF pages, fit/hide/rotation, note alignment, manual-mode pan, zoom and Layout regression. Exact prior-table/source comparison confirms no takeoff mutation. Initial HTTP helper failure corrected; see [floorplan evidence](evidence/floorplans-2026-10-28.json). Large-plan memory, exhausted 16-member loading, missing-source Retry and complete cross-sheet annotation behavior remain unverified.

2026-10-28 member annotation/selection review: 85/85 local pass. New tests verify real cropped PDF transforms/identity and drawing-wide selection reconciliation across exclusions, factors and classifications. Browser exercises all four neighbour editor types, marker visibility, draft/space-pan guards, source previews/navigation and all-page totals with identical complete API state. See [evidence](evidence/member-selection-review-2026-10-28.json). No save-factor browser mutation or large-plan performance claim.

2026-10-28 coverage: five tests expand the suite to 90/90. Validate real schema 10 column migration, persistence, invalid/stale writes, forced audit rollback, actual cropped PDF transforms and HTTP gates. Browser verifies count/point inputs, zero/remove, Escape, global visibility, neighbours, unscaled hint, rotation, zoom and reopen. Independent DB comparison preserves all 20 previous tables on migration and all previous values except edited record versions after browser saves. Five immutable source digests verified. Initial empty-object status mismatch fixed and rerun. [Evidence](evidence/coverage-2026-10-28.json).

Coverage hosted confirmation: commit 84df414, run 40658787531/job 122716294119, 90/90 pass on Ubuntu 24.04/Node 24.22.0. Live REA fixture recheck independently passes 7 structural comparisons and 3/3 behavior tests; do not confuse static semantic unknowns with complete behavior recovery.

2026-10-28: selection editing expands to 96/96 local tests (15733.320604 ms), with real PDF isolated paths/anchors, independent six-symbol truth, other-example/manual/reviewed correction retention, schema 11 migration, optimistic concurrency, audit-failure rollback, workbook provenance and HTTP checks. Browser confirms erase/Shift restore/all/cancel, Done recount, false detection removal, factor/exclusion retention, cancel during recount and identical state after reload. Workbook empty-sheet regression and nondeterministic fixture ordering fixed before final pass. Restricted localhost run failed EPERM; permitted rerun passed. [Evidence](evidence/selection-editing-2026-10-28.json). Remaining negative/distractor and rotated/scaled recognition corpus is a required next task.

2026-10-28 ADR-0031: 98/98 local tests, 16625.479531 ms. Independent asymmetric raster controls expose the positive-only dense-block false positive; neutral erased-pixel masking retains background evidence and yields exactly the declared supported matches. Rotated/enlarged positives document unsupported scope, not invariance. Original actual PDF rendering/centre checks pass with refined score. Browser worker path saves binary-elements-2, appends audit and preserves every mark/correction/quantity. [Evidence](evidence/recognition-negative-controls-2026-10-28.json). Preceding selection-editor source c1907788 passed 96/96 hosted tests, run 40667511663/job 122745645524.

ADR-0031 hosted confirmation: source 8cae73aa, run 40668482691/job 122748974913 passed 98/98, zero failures, 35863.308052 ms on Ubuntu 24.04/Node 24.22.0. All 126 source blobs matched local. Documentation-only handover follows; no redundant test rerun.

2026-10-28 selection deletion:104/104 local tests,17379.448089 ms. Six new tests cover cross-drawing attribution and preservation, ledger/history/export/reopen, optimistic snapshots and audit rollback, missing sources/original references, actual schema12 migration and HTTP gates. Browser row/editor Cancel, scoped confirm, actual six-symbol creation→empty-editor deletion/pruning, Shift bypass and console checks pass. Migration preserves all22 prior tables exactly. [Evidence](evidence/selection-deletion-2026-10-28.json).

2026-10-29 selection movement:111/111 final local tests,15098.042122 ms. Seven new tests cover ownership/correction preservation, recount dedup after move, historical visibility/round trip, stale/collision/duplicate/capacity rejection, audit rollback, workbook/deletion/reopen, schema13 migration and HTTP. Earlier111-test run also passed; strengthened capacity/stale/ordering checks then reran. Real Chrome drag and chooser return verified source8/correction2 at factor2; stale save preserved state. Actual workbook downloaded through browser reopens independently with six instances, all reviewed, original names, both movement events and digest agreement. [Evidence](evidence/selection-movement-2026-10-29.json).
