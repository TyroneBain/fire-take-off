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
