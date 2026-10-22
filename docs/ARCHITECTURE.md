# Architecture — local core adopted; later candidates remain under evaluation

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

ADR-0008 adopts a reversible first increment: Node 24.22, built-in SQLite, immutable source files, browser-native ES modules and PDF.js 6.4.299. The app is local and single-user. React/TypeScript, packaging, computer vision and workbook candidates below remain unadopted. The earlier recommendation table is retained as alternatives for later evidence-led decisions.

## Candidate stack

| Concern | Recommended candidate and reason | Trade-offs / validation needed |
| --- | --- | --- |
| UI/domain | TypeScript with React and a small Vite frontend; typed domain modules independent of rendering | Extra tooling; benchmark viewer behavior before adopting state or canvas libraries. |
| Initial macOS delivery | Browser-first UI with a local Node service bound to loopback; evaluate Electron packaging after viewer spike | Local service lifecycle, origin checks and file grants need design. Electron simplifies filesystem/worker distribution but adds Chromium size, signing and privileged IPC risks. |
| PDF | PDF.js for page rendering/parsing, workers and bounded page/tile caches | Large raster sheets can exceed memory; verify high-DPI rendering, rotated cropboxes, incremental loading and tile strategy. Evaluate PDFium only if measured limits justify native packaging/licensing complexity. |
| Interactive marks | Canvas 2D overlays initially, independent of PDF raster; spatial indexing and viewport culling | SVG improves accessibility but may degrade with many marks; WebGL/Pixi offers scale with added complexity. Measure realistic counts before choosing. |
| Recognition | Extract own PDF primitives where useful; benchmark OpenCV template matching for raster/vector-rendered inputs; separate worker process | Matching is a baseline, not proof of Smart Select parity. Rotation/scale, noisy scans and similar symbols need measured handling; Python sidecar adds packaging, OpenCV.js can inflate browser memory. Evaluate both. |
| Smart Select | Separate classifier/naming interface with editable suggestions | No licensed training corpus yet. Do not use Countfire models/data; useful naming accuracy and provenance must be established independently. |
| Geometry | Pure TypeScript page-space geometry; explicit affine transforms and calibration metadata; real units independent of zoom | Robust polygon intersections, holes, self-crossings, tolerances and precision require acceptance specifications. Evaluate a geometry library after those are known. |
| Storage | SQLite metadata and immutable source files in a private project store, hashes and transactional migrations | Suitable initial single-user workload; backups must include source files consistently. Shared multiuser service likely needs PostgreSQL/object storage later. Do not share a live SQLite file over network sync. |
| Jobs | Bounded worker/process queue with cancellation, progress, source-version IDs and deterministic replay | No distributed queue required initially. Recogniser crashes must not corrupt project data or block UI. |
| Spreadsheet | Evaluate ExcelJS for XLSX schedules and quotes | Confirm maintenance/security/licence, large-file memory, formulas, Excel/LibreOffice compatibility and injection protection before adoption. |
| Tests | Node test runner for fixture; future Vitest/domain tests, Playwright workflow tests, independent geometry/detection/export oracles | Browser screenshot tests alone cannot verify quantities or drawing fidelity. Tool versions remain unselected. |
| Future parity | Service boundaries for identity, projects, jobs, exports and integrations; retain explicit collaboration backlog | Local-first recommendation does not fulfil Countfire's cloud collaboration. Sync/conflict control needs a later ADR and acceptance suite. |

## Alternatives

Electron + TypeScript: simplest one-language desktop shell and direct filesystem access; larger distribution and strict renderer isolation/IPC validation needed. Tauri + Rust: smaller shell and a constrained command boundary; adds Rust and platform WebView variation plus CV integration work. Browser + local service: preserves a path to web parity and familiar UI tools; requires lifecycle/authentication design for loopback endpoints. Hosted web service: closest multiuser access model, but introduces hosting, privacy, authentication and operating costs before the core is proven.

## Proposed logical model

Project → takeoff → discipline → drawing → immutable revision/page, with explicit floor grouping where required. Authenticated beta UI observation on 2026-10-22 confirmed separate takeoffs within a project; this refines the proposed model without selecting an implementation. Page stores native dimensions/rotation/crop and calibration. Symbol definitions refer to examples; detections retain source revision, algorithm/version, confidence and human acceptance. Manual overrides are explicit records. Measures and zones reference stable page coordinates; schedules derive from a versioned accepted quantity snapshot. Estimates consume snapshots and store pricing versions separately from current price libraries.

Quantities must not depend on screen pixels. Use explicit document-to-screen transforms, stable IDs, unit conversions and recorded rounding. Keep immutable originals, bounded caches and recoverable transactions. Original documents remain private and outside Git.

## Decision gates

Phase 1: choose workflow scope, dataset provenance, benchmark budgets and output contracts. Phase 2 spike: compare large-PDF memory/render fidelity and mark interaction on actual hardware. Phase 3 spike: compare independent matching approaches against ground truth. The initial local core choice is ADR-0008; later stack choices still require their own evidence. No claim of Countfire internals is needed.

## Primary references consulted 2026-10-22

- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF parsing/rendering platform.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) — renderer isolation and privileged application risks.
- [OpenCV template matching](https://docs.opencv.org/4.13.0/d4/dc6/tutorial_py_template_matching.html) — template comparison primitive, not a complete detector.
- [SQLite appropriate uses](https://www.sqlite.org/whentouse.html) — local application storage versus shared server workloads.
- [ExcelJS upstream](https://github.com/exceljs/exceljs) — candidate workbook library; current package suitability not yet verified.


## Implemented core boundaries

`apps/local/server.mjs` binds to 127.0.0.1, checks host/origin and requires a session token on writes. `store.mjs` owns SQLite entities/drawings and immutable hashed source files. `pdf-inspect.mjs` parses each import in a 256 MiB old-space child process with 20-second timeout, 200-page limit and at most two concurrent parsers. Intake is limited to 25 MiB per PDF. These provisional local capacity limits are not reference limits or accepted benchmark budgets.

Browser controls use the PDF.js display layer with its own worker, character maps/fonts and WebAssembly codecs. CSP permits local scripts and WebAssembly compilation without permitting JavaScript eval; PDF eval support is disabled. Display canvases are capped at 16 million backing pixels and device scale 2. Document coordinates remain native PDF page coordinates. Source rotation/crop geometry is retained and PDF.js applies its viewport transform. Text search, persistent view transforms and tiled rendering are not implemented. Plain-text page notes are now a separate overlay backed by immutable PDF coordinates.

SQLite schema version 3 is explicit, with tested transactional migrations from versions 1 and 2. Database reopen, source integrity and shared-source deletion have passing tests. Removing a drawing retains source bytes; retention/garbage collection and backup/restore remain future work. Database/files are not one portable archive, so a backup must quiesce the service and include the full data directory.

Notes reference drawing/page, native x/y and versioned plain text. The browser coordinates helper compensates for CSS/display sizing before PDF.js inverse transformation; note markers use the forward viewport transform. Old markers are removed during rerenders to prevent placing notes against stale transforms. Optimistic note updates/deletion reject stale versions. See ADR-0009 and notes evidence.

Versioned page_metadata rows keep manual page names/titles separate from original PDF bytes, geometry and note anchors. Drawing/page metadata import is atomic. Custom single-page names appear on drawing cards and the viewer toolbar while original filenames remain visible. Automatic title extraction remains unimplemented.

ADR-0010 adds schema 4 count definitions/instances/review audit/calibrations/measurement geometry in takeoff-store.mjs, pure geometry and bounded binary-overlap matching modules, cancellable browser worker/UI orchestration, and ExcelJS snapshot exports in workbook.mjs. Native PDF coordinates remain canonical; quantities derive server-side. Pending review and unknown scale block export. Matching is deliberately limited to same-size/orientation original examples; it does not establish general recognition.

Schema 5 adds zone-headings and outlines via zone-store.mjs. zone-allocation.mjs derives disjoint priority regions with pinned polygon-clipping, splits lines by exact segment intersections and returns quantitySchedule rows with zone/source provenance. Both application totals and zoned XLSX use these derived rows. Canonical source geometry is never clipped in storage. zone-ui.mjs handles drawing/edit drafts with Save/Cancel and versioned API writes. See ADR-0011 for provisional edge/capacity policies.

## Schema 6 — count examples and classification

ADR-0013 adds count_examples (unique canonical source example per item), count item versions and immutable original_item_id on matches. Additional runs merge in one transaction; any stale source/scope/error rolls back every new example/mark. Deduplication checks both current and original item at the existing native-point tolerance, preserving decisions. Reclassification validates destination scope/collisions, then updates the mark and audit using a savepoint (compatible with bulk-review transactions). Snapshots include all examples; workbook hashes include them, and instance/history sheets include current/original and before/after heading identities. UI reclassification operates on a captured current-page queue ordered by initial viewport proximity; changes save individually. Full global save/undo behavior remains unimplemented.
