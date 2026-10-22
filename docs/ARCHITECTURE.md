# Architecture evaluation — recommendation, not adopted

No product framework, runtime packaging or computer-vision dependency is installed in Phase 0. Validate these candidates against Phase 1 workflows and Phase 2 spikes before accepting an ADR.

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

Phase 1: choose workflow scope, dataset provenance, benchmark budgets and output contracts. Phase 2 spike: compare large-PDF memory/render fidelity and mark interaction on actual hardware. Phase 3 spike: compare independent matching approaches against ground truth. Accept stack ADRs only after evidence; no claim of Countfire internals is needed.

## Primary references consulted 2026-10-22

- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF parsing/rendering platform.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) — renderer isolation and privileged application risks.
- [OpenCV template matching](https://docs.opencv.org/4.13.0/d4/dc6/tutorial_py_template_matching.html) — template comparison primitive, not a complete detector.
- [SQLite appropriate uses](https://www.sqlite.org/whentouse.html) — local application storage versus shared server workloads.
- [ExcelJS upstream](https://github.com/exceljs/exceljs) — candidate workbook library; current package suitability not yet verified.
