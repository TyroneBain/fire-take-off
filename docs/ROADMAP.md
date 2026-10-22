# Roadmap

Every phase updates CURRENT_STATE and parity IDs. Dependencies flow in order; Phase 1 research may refine later work but may not waive acceptance gates without a recorded decision.

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

Live REA MCP owned-fixture verification passed on 2026-10-22; publish its evidence to finish the Phase 0 delivery checkpoint. Continue Phase 1 using WORKFLOW_SPECIFICATIONS.md and ACCEPTANCE_CASES.md. The original vector corpus generator is available; rendering, raster/multipage sets, P0 reference behavior, tolerances, budgets and stack ADR remain incomplete. Application scaffolding awaits Phase 1 exit.
