# Decision record

## ADR-0010 — Working takeoff loop with bounded original matching (accepted 2026-10-22)

Continue past the shell into selection → matching → review/correction → saved quantities and calibrated manual measures. Use an original binary-image overlap matcher in a cancellable browser worker over PDF.js renders, retaining example bounds, algorithm version, scores and source-page identity. Initial matching is same-scale and limited to bounded pages/pixels/operations; no claim of general recognition accuracy or Smart Select. Failed/cancelled runs commit nothing. Persist each result and explicit included/reviewed state; manual corrections survive because reruns do not replace saved marks. Audit inclusion/review changes. Quantities derive from included instances rather than editable totals.

Manual points/lengths/simple polygon areas store native page coordinates. Calibration stores two source points, known distance/unit and metres per PDF point; uncalibrated length/area quantities remain unavailable. Reject invalid/self-crossing/degenerate geometry. These are original declared policies, not assertions of unresolved Countfire boundary/recount behavior. Keep research and full parity requirements open. Schema 4 migrates existing projects, page metadata and notes without changing originals.

Adopt pinned ExcelJS 4.4.0 (MIT) for original quantity workbooks after package/notice review. Export from a captured saved-state snapshot, include instance review/provenance and drawing hashes, and refuse unreviewed included automatic marks or uncalibrated length/area values. Workbook layout is original; full reference schema/estimating parity remains separate. Independently inspect generated ZIP/XML values in addition to library readback.

## ADR-0008 — Stage research gates by subsystem (accepted 2026-10-22)

Phase 0 is complete and remotely delivered. The global Phase 1 gate has prevented any usable application while advanced behavior research and the reference upload tool remain blocked. Proceed with a reversible local project/PDF core using the already observed hierarchy and original fixtures. Keep unresolved reference rules as gates on their affected counting, measurement, revision and estimating subsystems. This changes sequencing, not scope or evidence standards: no feature is VERIFIED without passing its acceptance cases, and the full Phase 1 baseline/benchmark obligations remain required before parity validation. Do not claim that repeated-page PDFs establish representative performance.

For the first runnable increment, adopt browser-native ES modules, a loopback Node 24 service, built-in SQLite metadata and immutable source files, and the PDF.js display API for original viewer controls. Plain modules avoid adding a UI framework before interaction requirements settle; they can later migrate behind the same domain/API contracts. SQLite in Node 24 is experimental, so retain explicit schema versioning and recovery tests. PDF.js must be pinned after installation and tested against the independent PDFKit oracle. No Countfire implementation or assets are reused. The service is local single-user software; cloud access/collaboration remain unmet.

## ADR-0001 — Private original implementation (accepted 2026-10-22)

Build Fire Take Off as a private functional equivalent using original code and authorised material. Keep full public takeoff/estimating parity as the objective. Do not extract Countfire source or reuse restricted assets. Consequence: public behavior research and our own acceptance fixtures drive implementation.

## ADR-0002 — Foundation gate and durable memory (accepted 2026-10-22)

Use root AGENTS.md and linked version-controlled documents as persistent memory. CURRENT_STATE is the recovery entry point; update after every meaningful session. No product build until Phase 0 mandatory checks pass. Consequence: successful documentation delivery alone cannot close Phase 0 if live REA access is unresolved.

## ADR-0003 — Defer product stack adoption (accepted 2026-10-22)

ARCHITECTURE is a recommendation with alternatives. Select dependencies and packaging only after measured PDF/recognition/geometry work and documented requirements. Empty apps/packages directories are intentional.

## ADR-0004 — Separate verification levels (accepted 2026-10-22)

Distinguish host prerequisites, REA installation, registration/instructions health, CLI analysis and live-session MCP analysis. Product features remain NOT STARTED. No status promotion from setup output or documentation alone.

## ADR-0005 — GitHub connector fallback (accepted 2026-10-22)

The connected GitHub account has admin/push permission on the private empty repository; shell Git cannot resolve github.com and gh is missing. Publish verified text files through GitHub Git-data/contents APIs with head checks, and reconcile local Git history by reproducing the authenticated remote commit/tree objects and verifying their hashes. Record this as API publication rather than a successful shell git push. Never replace unknown remote work.

## ADR-0006 — Authenticated UI evidence and takeoff boundaries (accepted 2026-10-22)

Chrome DevTools MCP now connects to the user's authenticated beta Countfire tab. Research uses normal visible workflows and stores only sanitised descriptions, not source, account data, project identifiers, private rates or third-party drawing assets. Observations are evidence of controls/navigation, not successful Countfire operation or Fire Take Off acceptance. Keep takeoffs as separate entities under a project, with estimates and specification comparisons also separate. Add title extraction and product catalogue requirements discovered in the UI. REA remains unverified; no product build starts unless the original gate passes or the user explicitly waives it.

## ADR-0007 — Independent research PDF oracle (accepted 2026-10-22)

Use installed Apple PDFKit/AppKit through small Swift research scripts to independently render and inspect original fixture PDFs. The future product renderer remains undecided. Repeated 10/100-page sets test page indexing only; they do not represent complex construction sheets or establish performance budgets. Keep generated assets ignored and record actual digests. Preserve source-specific documented rules separately from executed reference behavior; browser upload denial cannot be treated as import success or bypassed.


## ADR-0009 — Page-space notes and explicit schema migration (accepted 2026-10-22)

Persist plain-text notes against immutable drawing ID and 1-based page number using native PDF coordinates within the actual crop box. Derive marker positions from PDF.js viewports and invert CSS pointer coordinates without storing backing-canvas pixels. Text edits/deletion require the current integer version to reject stale changes. Schema 1 migrates transactionally to schema 2; existing drawing records and sources remain intact. Drawing deletion cascades its notes. Text note anchors are the first annotation increment; cloud shapes, repositioning, exports and unsaved-exit handling remain separate work.

Page metadata follows the same separation: schema 3 adds versioned names/titles keyed by immutable drawing ID and page number, without changing PDF bytes or page geometry. Initial names are Page 1, Page 2, etc.; manual title entry is separate from future automatic title extraction. Import must commit drawing and all page metadata atomically; migrations preserve existing notes.

ExcelJS installation audit exposed its UUID <11.1.1 dependency advisory GHSA-w5hq-g745-h8pq. ExcelJS uses only the v4 CommonJS export; pinned override 11.1.1 retains that export and avoids the advisory. Workbook tests and repeat audit must pass before delivery. Installation deprecation notices remain recorded; do not claim every transitive package is actively maintained.

## ADR-0011 — Zone allocation with explicit boundary policy (accepted 2026-10-22)

Persist discipline-level ordered zone headings and per-page simple polygon outlines in schema 5. With no polygons on a page, its whole page contributes; once a page has polygons, outside quantities are excluded. First heading wins overlaps, and same-heading polygons form a union. Count/point boundary ties and line segments lying on edges go to the first eligible heading (our explicit provisional policy, not observed Countfire boundary behavior). Split non-itemised line/area quantities geometrically between effective disjoint regions; itemised dominant-zone behavior remains separate F064 work. Editing, reordering and deletion recalculate allocations without changing source counts/geometry. Heading deletion cascades its polygons. Reject stale mutations and wrong-discipline outlines. Bound each outline to 200 vertices, 100 polygons/page and 100 headings/discipline; these are provisional capacities.

Adopt polygon-clipping 0.15.7 (MIT) for server-side polygon union/intersection/difference, including concavity and holes in derived regions; original segment splitting handles lengths. Use analytic independent tests and conservation checks. Return derived allocation rows in the application state and write those exact rows into zone-aware XLSX, keeping raw instances as audit evidence. Preserve no-zone export compatibility. This addresses documented zone scope and priority; it does not establish reference boundary/tie parity, itemisation, zone multipliers or copy workflows.
