# Roadmap

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

Every phase updates CURRENT_STATE and parity IDs. Dependencies flow in order; Phase 1 research may refine later work but may not waive acceptance gates without a recorded decision.

ADR-0008 changes sequencing after successful Phase 0: the project/PDF core may proceed while Phase 1 research continues. Unresolved rules gate their affected subsystems, and full baseline/benchmark obligations remain mandatory before parity validation. This is not a Phase 1 completion claim.

| Phase | Deliverables | Measurable exit gate |
| --- | --- | --- |
| 0 — Foundation | Private repository, permanent memory, sourced inventory, roadmap, architecture evaluation, REA registration/instructions/health/owned-fixture evidence | Documents validated and committed remotely; private status confirmed; matching REA setup healthy; CLI and live Codex MCP analysis accurate on owned fixture; handover complete. Remains open if any mandatory check is blocked. |
| 1 — Research/specifications | Dated feature baseline, authorised normal UI observations, workflow/error-state specifications, reference dataset and acceptance matrix, architecture ADR | Every inventory entry has testable requirements or explicit unresolved questions; P0 workflow unknowns resolved; benchmark set and tolerances agreed; stack decision documented. |
| 2 — Core PDF application | Project persistence, drawing upload/storage/indexing, high-resolution viewer, pan/zoom/page navigation, notes and coordinate transforms | Import/reopen/delete workflows pass; geometry remains stable through zoom, rotation and crop; corrupted/large PDFs fail safely; recorded performance baseline on representative fixtures. |
| 3 — Recognition/counting | Symbol examples, matching across pages/disciplines, Smart Select naming/grouping, manual additions/removals and review | Ground-truth comparison reports precision/recall by fixture and transform; duplicate handling, corrections, scope isolation and deterministic totals pass; agreed accuracy/performance targets met. |
| 4 — Measurements/zones/management | Calibration, connected lengths, points/areas, drops/risers, fittings, copying systems/zones, coverage and drawing organisation | Unit, area, scale and boundary acceptance cases pass; invalid calibration rejected; live zone totals and persisted edits reconcile with schedules. |
| 5 — Revisions/advanced takeoffs | Overlay/floorplan positioning, comparison, recounting revisions, specification comparison and advanced review | Known revision changes detected; original quantities preserved; alignment and correction migration tested; visual/export evidence traceable to revision. |
| 6 — Schedules/estimating | Quantity schedules, Excel and record outputs, price lists/kits/history, prelims, margins, configurable estimates, integrations/collaboration foundations | Workbook values reconcile with approved takeoff; cost/margin/rounding cases pass; quote exports reopen; integration/auth failures tested; remaining public workflow requirements covered. |
| 7 — Parity validation | End-to-end acceptance suite, representative trade/size corpus, performance/accessibility/recovery testing and remaining collaboration/integrations | Every baseline feature VERIFIED against acceptance evidence or explicitly acknowledged unmet scope; no claim of full parity while any required entry remains unmet. |

## Initial priority

P0: essential drawing/count/review/measurement/export workflows. P1: advanced takeoff, estimating and complete parity features. P2: reference functionality announced but not confirmed shipped, plus uncertain trade-specific behavior. Priorities sequence work; they never silently remove scope.

## Benchmark policy

Phase 1 must select small/medium/large authorised vector and raster drawing sets, disclose machine specifications, and agree budgets for first-page render, zoom response, memory, multi-page recognition and export. No arbitrary throughput or recognition percentage is currently accepted. Measure before selecting irreversible architecture.

## Next gate

Phase 0 COMPLETE: live MCP evidence and foundation handover published as `53de3e8580c3a8d003c9ae6f75bd915dd29c760b`, with matching local/remote trees. Phase 1 IN DEVELOPMENT: public rules and 71-entry inventory, 16 acceptance cases, independently inspected original corpus. ADR-0008 permits the local project/PDF core next. Still incomplete: reference drawing execution, boundary/tie policies, realistic dataset complexity and measured/accepted budgets. Browser upload tool denies the reference fixture path. These obligations remain explicit and cannot be reported as passed based on documentation or repeated-page fixtures.

## First runnable increment

Phase 2 IN DEVELOPMENT under ADR-0008. Local project/takeoff/discipline persistence, bounded PDF intake, original viewer controls and drawing removal are implemented and partially TESTED (F001–F006). Phase 2 exit remains unmet: notes, full geometry interaction, recovery and representative performance evidence are incomplete. Full Phase 1 research continues; no reference requirements or acceptance standards were removed.

F007 text notes now persist with edit/delete/cancel and crop/zoom/rotation checks. Phase 2 remains open for full geometry interactions, robust recovery/accessibility and representative performance; no complete parity or Phase 1 completion claim. Next: editable page metadata and original manual count/measurement workflows with separately specified policies.

F003 manual page name/title editing is partially TESTED with source/note preservation. Next core/takeoff work: editable entity metadata, manual points and calibrated analytic measurements; automatic title extraction and all full-parity obligations remain pending.

ADR-0010 takeoff-loop increment: original bounded matching, corrections/review, calibrated point/length/area tools and XLSX are partially TESTED (27 passing suite tests including 3 REA diagnostics). Phases 3/4/6 remain IN DEVELOPMENT, with no exit gates met. Zones, representative recognition benchmarks, connected systems, estimating and full workbook parity remain outstanding.

ADR-0011 zone increment: partial F021/F063 TESTED; F034–F035 include zoned export columns. Suite 34/34. Phase 4 remains IN DEVELOPMENT: boundary parity, live preview, copying, itemisation/multipliers and performance acceptance still open.

2026-10-23 counting checkpoint: ADR-0013 implemented/tested multiple examples, correction-preserving merge, heading name/colour edits, individual reclassification, page keyboard review and export provenance (42/42 suite). Continue selection management/visibility and representative matching benchmarks; full Smart Select, cross-page reclassification/global-save semantics, revisions and estimating remain open.

2026-10-27 review checkpoint: saved-example thumbnails/source navigation, heading filtering and transient marker visibility tested (43/43). Added F072 selection review list and F073 element editing to retain discovered obligations. Next: pointer-centred zoom and hold-space panning, followed by source-element selection management, multipliers and revision comparison. Full reference hiding semantics are still open.

2026-10-27 navigation checkpoint: pointer-centred zoom, space/middle/Navigate drag pan and Space+tool shortcuts passed browser checks and 43/43 suite. Next executable product work: editable measurements with versioned geometry, followed by remaining selection management, multipliers and revisions. Saved viewport context and full gesture parity remain open.

2026-10-27 measurement checkpoint: versioned edits, geometry/node controls and quantity/zone/export reconciliation passed 48/48 suite plus browser Save/Cancel checks. Remaining foundation task: automate this suite in private GitHub CI; continue selection management, multipliers, revisions and estimating after that checkpoint.

Private CI workflow added on 2026-10-27 under ADR-0017. Hosted run 40461405478 passed 48/48; actual run/job logs and environment recorded in evidence/ci-2026-10-27.json. This verifies portable suite automation, not full product parity.

2026-10-27 multiplier checkpoint: schema 7 selection-linked count multipliers, safe legacy attribution and weighted quantity/export audit tested (54/54 local). Browser 78 raw instances→468 items at x6→78 at x1; no duplicate detections. Next: source-grounded measurement/zone multiplier rules and revision comparison; full selection element editing remains a larger open dependency.

2026-10-28: ADR-0019 length/zone multipliers passed 61/61 local plus browser checks. Continue project workflow/layout fidelity from the now-accessible authenticated reference; then remaining selection/revision workflows. No phase exit or full parity claim.

2026-10-28: ADR-0020 sequences project lifecycle/table fidelity next after the tested quantity-factor increment. This addresses the user's explicit visual-clone requirement and the confirmed account's project workflow. Full estimating/assignment/catalogue remain open; working takeoff features are preserved.

2026-10-28: ADR-0020 project table/lifecycle passed 67/67 local and browser checks. Next: publish/observe its CI, then drawing workspace fidelity and revision comparison. Phase 1 research, representative benchmarks and full product gates remain open.

2026-10-28: ADR-0021 editor layout/whole-page fit passed browser checks and 67/67 local regression suite. Publish/check hosted run next, then revision comparison on owned base/revision fixtures. Missing Layout, source-element editing, Smart Select, global save and estimating remain explicit.

2026-10-28: ADR-0022 transient drawing comparison passes 70/70 local tests and browser alignment/lifecycle/no-mutation checks. F032 partial TESTED. Next: protected publication/CI, then Layout overlays/floorplans and revision recount. Phase 5 exit remains unmet.
