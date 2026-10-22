# Testing strategy

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

Later CI should run deterministic domain and workflow tests, dependency/security checks and schema migration/recovery tests. The workflow directory is intentionally a placeholder until executable product checks and a toolchain are chosen. Never describe absent CI as passing.

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
