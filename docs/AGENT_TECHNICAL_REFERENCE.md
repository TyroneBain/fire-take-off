# Specialist technical reference — Fire Take Off
2026-10-30. This is a curated, maintained learning syllabus and execution contract, **not model fine-tuning** or a claim that agents have read every linked source. Verify current editions, API compatibility, licences and local code before implementation. Prefer primary documentation, actual repository tests and owner-authorised drawings over generic AI summaries.

## Shared project truth (all agents)
Read in order: `AGENTS.md`; `docs/CODEX_AGENT_TEAM.md`; `docs/COUNTING_COMPETITIVE_EXECUTION_PLAN_2026-10.md`; `docs/CURRENT_STATE.md` (read newest checkpoint); `docs/FEATURE_PARITY.md`; `README.md`; `docs/ARCHITECTURE.md`; applicable tests/evidence. Inspect current source and git status: historical documentation can be stale. Existing matching includes pixel comparison and partial vector paint-operation cleanup; never assume no vector support or claim vector matching is complete. No real-world Countfire parity is established.

## Vector Recognition Engineer — priority 1
**Study:**
- ISO 32000-2 (PDF 2.0) specification overview / normative standard: https://www.iso.org/standard/75839.html (check access/licence; do not copy restricted text)
- PDF.js project and API: https://mozilla.github.io/pdf.js/ and https://github.com/mozilla/pdf.js
- PDF.js operator list and transform implementation in the **installed pinned version**, not examples from an unrelated version
- PyMuPDF documentation for independent PDF inspection/oracle: https://pymupdf.readthedocs.io/ (only if licence/dependency policy permits)
- OpenCV documentation for fallback image matching and feature methods: https://docs.opencv.org/4.x/
- Computational geometry fundamentals: affine matrices, clipping paths, winding/fill rules, strokes vs fills, Bézier curves, nested Form XObjects, coordinate normalization, line caps/joins, text-as-symbols, spatial indexes, nearest-neighbour candidate filtering, robust geometric signatures and approximate matching.
**Repository work:** use REA on our own source to map PDF parse/render/selection/paint operation/matcher/correction/persistence/zone/export pipeline. Do a feasibility spike with a real authorised vector PDF. Compare geometry matching vs raster fallback using independently labelled expected instances. Preserve existing saved IDs and review decisions; don't modify unrelated UI. 
**Deliverable:** minimal architecture decision, code/tests, measured precision/recall/latency, hard failure cases and next blocker. Do not assert a universal PDF symbol algorithm exists or that PDF path operators map cleanly to semantic objects.

## QA / Benchmark Engineer — independent evidence
**Study:**
- NIST software testing resources: https://www.nist.gov/itl/ssd/software-quality-group
- Playwright testing guides (if used by repo): https://playwright.dev/docs/intro
- Node.js test runner docs (match installed Node): https://nodejs.org/api/test.html
- OWASP file upload security: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
**Method:** maintain independent, authorised ground truth at symbol-instance level, with sheet, type, center/bounds and ambiguity policy; label positives/negatives before running matcher. Report TP/FP/FN, precision=TP/(TP+FP), recall=TP/(TP+FN), per-class and per-sheet, duplicate detection, elapsed time, memory, correction clicks, estimator task time, crash/reopen and exported quantity reconciliation. Do not treat 127 passing synthetic tests as real-drawing recognition proof. Record PDF provenance and permission without committing private files. Include clean vector, crossing lines, rotation, scale, lookalikes, raster, revisions, zones and cancelled jobs. Regression-test all saved correction IDs and exports.

## Fire Estimating Workflow Expert — domain acceptance
**Study/verify from current official sources:**
- Australian Building Codes Board, NCC: https://ncc.abcb.gov.au/ (verify current edition, state adoption and project relevance)
- Standards Australia catalogue: https://www.standards.org.au/ (check applicable editions and licensing; don't reproduce paid standards)
- Australian Fire Protection Association: https://www.fpaa.com.au/
- Relevant project documentation: hydraulic/fire-services drawings, legends, schedules, revisions, specifications and owner-approved scope.
**Scope:** test counts of sprinkler heads by type, hydrants, hose reels, valves, alarms, fittings and pipe runs only where supported by drawing legend and scope; identify symbols reused across sheets, risers, detail callouts, excluded backgrounds, repeated floor plans and revision clouds. Distinguish takeoff quantity from compliant design or engineering certification. Check scale calibration, metres vs millimetres, grouping/zone overlap and audit trail. Provide short estimator workflows and independently verified expected totals, not guesses. Don't assume every project uses the same symbol legend or Australian Standard.

## Estimating / Excel Engineer — deferred until counting passes
**Study:**
- Microsoft Excel specifications and limits: https://support.microsoft.com/en-us/excel
- Open XML spreadsheet structure: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/
- ExcelJS repository/API, matched to pinned version: https://github.com/exceljs/exceljs
- OWASP CSV/formula injection guidance: https://owasp.org/www-community/attacks/CSV_Injection
**Contract:** audit quantity source and scope, base vs factor-adjusted values, unit conversion, zone allocation, revisions, rounding, review gates, formulas vs cached values, stable export headers, provenance and spreadsheet injection. Independently reopen workbook and reconcile every row/column with the saved takeoff. Never infer labour/material prices or alter business formulas without user-approved estimating model. Do not start catalogue or pricing implementation until lead assigns it.

## Lead Engineer / Orchestrator
**Study:** existing repo AGENTS and architecture; GitHub code review practices https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests ; Codex multi-agent configuration guidance https://developers.openai.com/codex/multi-agent/ (verify version/feature support before relying on syntax). Assign one writer per file area; use bounded tasks, small diffs, evidence-based acceptance and no force pushes. The main agent owns integration, review, prioritisation and the final benchmark decision.

## Information quality rules
1. Official docs and installed source > reputable technical reference > blogs/videos > AI-generated guesses.
2. Date and link important references, identify edition/version and licensing constraints; don't claim that linking means the source was read.
3. No Countfire hidden APIs, proprietary code, asset copying or contractual bypass. Permitted UI observations only.
4. Ask owner for licensed/authorised representative PDF sets and verified expected counts; never commit customer drawings.
5. Log what is demonstrated, what is partial, what is unknown and what is blocked.
6. Update this reference when a source changes or a benchmark disproves an assumption.

## Multidisciplinary MEP estimating knowledge — replaces fire-only scope
The existing fire_workflow agent covers six disciplines: (1) electrical power and containment, (2) lighting and emergency lighting, (3) fire sprinklers/hydrants/hose reels, (4) security and fire detection/alarm, (5) structured data cabling and audiovisual, (6) mechanical HVAC. For each, consult project legends, equipment schedules, specifications, current Australian NCC and relevant standards catalogue entries, manufacturer manuals and estimator-verified examples. Official starting points: https://ncc.abcb.gov.au/ ; https://www.standards.org.au/ ; https://www.acma.gov.au/ ; https://www.fpaa.com.au/ . Verify current editions, state applicability and licensing; never assume a takeoff verifies design compliance. Test symbol types, lookalikes, scale, duplicate detail sheets, counts, linear/area measurements, multi-unit symbol multipliers, zones, revisions and Excel reconciliation. Use one shared geometry matcher with trade-specific interpretation; fire is the first measured benchmark.

## Competitive analyst — market evidence
Read docs/COMPETITIVE_AI_ROADMAP_2026-10.md and review dated public evidence for Countfire (https://www.countfire.com/), Groundplan (https://groundplan.com/), Bluebeam (https://www.bluebeam.com/), PlanSwift (https://www.planswift.com/), Autodesk Takeoff (https://construction.autodesk.com/products/takeoff/), STACK (https://www.stackct.com/). Verify current product positioning and claims before citing. Compare supported trades, symbol search/counting, vector vs raster behavior, drawing preparation, accuracy on owner-authorised test sets, manual corrections, measurements, zones, revisions, export, collaboration, speed, cost and learning curve. Log source URLs and dates, vendor claims vs verified observation, and unknowns. Recommend highest-impact independently implementable gaps with clear acceptance tests; never copy proprietary code, private APIs, brand assets or distinctive UI.
