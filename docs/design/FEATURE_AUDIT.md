# Existing functionality audit — 29 October 2026

This is an audit of the current application, not a redesigned feature specification. Canonical status is preserved from [FEATURE_PARITY](../FEATURE_PARITY.md). TESTED means a partial tested scope, not finished parity. No entry is VERIFIED. 77 entries: 35 TESTED, 42 NOT STARTED. The 125-test suite passed in this phase; it does not test every requested workflow or certify realistic recognition accuracy.

## Interpretation and documentation drift

- F007: the current workbook includes a Notes sheet. Remaining gaps include richer note geometry/repositioning; the older export-missing phrase is stale.
- F032: revision comparison and F033 recount are separate partial capabilities; the comparison row's blanket recount-missing phrase is stale.
- F056: some shortcuts already work (Space pan/tool chords, reclassification and selection actions), but full keyboard-only operation remains unmet. Preserve NOT STARTED for the broad requirement until its acceptance is defined and met.
- F036: a single XLSX export works under F035; a complete output-generation/download lifecycle does not.
- F059: open discovery bucket, not a bounded testable feature. Do not use these 77 rows as equal units of completion.
- F061 and catalogue-dependent F043/F044 remain deferred by the user. No catalogue proposal is included.
- Several new design interactions (global undo, persistent view state, review queue, accessible geometry entry, export snapshot) require explicit future requirements; they are not hidden inside a styling task.

## Complete inventory

Each row retains the canonical source key, required acceptance, and known limitations. Resolve source keys in FEATURE_PARITY. Existing evidence files are linked by that inventory and the report. “Not started” means no completed end-to-end capability was established; small related primitives may exist.

| ID | Capability | Source | Current status | Acceptance required | Current implementation / gap |
| --- | --- | --- | --- | --- | --- |
| F001 | Project management | U,S2,S14 | TESTED | Persistence, isolation, archive recovery | Project metadata, local-owner scopes, statuses, archive/restore, filtering/sorting and table UI tested; full assignment/permission and exact visual parity remain missing; evidence projects-2026-10-28.json |
| F002 | Drawing upload/storage | U,S1,S14 | TESTED | Corrupt files, duplicates, missing sources | Import/source integrity and rejection tests pass; 25 MiB/200-page local limits; native picker and encrypted-file acceptance untested; evidence local-core-2026-10-22.json |
| F003 | Drawing organisation | U,S8,S14 | TESTED | Isolation and ordering survive reopen | Hierarchy and page name/title editing tested; entity rename, reorder and floor grouping remain missing; evidence local-core-2026-10-22.json |
| F004 | High-resolution PDF viewer | U | TESTED | Fiducials, text, linework, large sheets | PDF.js vector/raster and rotated/cropped browser render observed; large-sheet fidelity and performance budgets unverified; evidence local-core-2026-10-22.json |
| F005 | Zoom/pan | U,S8 | TESTED | Pointer coordinates invariant under transforms | Pointer-centred Ctrl/Cmd wheel zoom, centre-anchored toolbar zoom and space/middle/Navigate dragging tested; saved view state and physical touch/trackpad acceptance missing; navigation-2026-10-27.json |
| F006 | Page/drawing navigation | U,S8,S14 | TESTED | State isolation and loading transitions | Ten-page next navigation observed; reopen data tested; keyboard paging and view-context persistence missing; evidence local-core-2026-10-22.json |
| F007 | Annotations/notes | U,S1,S14 | TESTED | Reopen, transforms and export inclusion | Text note create/edit/delete, cancel, reopen and crop/zoom/rotation anchors tested; clouds, repositioning and export missing; evidence notes-2026-10-22.json |
| F008 | Symbol example selection | U,S1,S14 | TESTED | Selection bounds and scope separation | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F009 | Automatic symbol counts | U,S1,S14 | TESTED | Ground-truth precision/recall and duplicates | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F010 | Cross-drawing counts | U,S1 | TESTED | Totals reconcile by drawing/floor | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F011 | Smart Select | U,S4,S14 | NOT STARTED | Editable names, mistaken classifications | Smart select control observed; no trained model or measured naming accuracy |
| F012 | Symbol groups/headings | S8,S20 | TESTED | Rename/delete and quantity reconciliation | Partial: heading name/colour and flat named groups, drag/chooser membership, Misc, collapse/visibility, rename and empty-group deletion tested; nesting, heading deletion, ordering and populated-group deletion parity unresolved; count-groups evidence |
| F013 | Manual corrections | U,S1 | TESTED | Undo/reopen preserves corrected totals | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F014 | Matched-item visibility | S8 | TESTED | Visibility does not mutate quantities | Partial per-heading/global overlay-marker controls and filter tested without saved-state mutation; underlying source-element suppression still absent |
| F015 | Background classification | S7,S14 | NOT STARTED | Discipline scope and grey-symbol retention | Hide Background switch observed; current classification behavior untested |
| F016 | Takeoff verification | U,S1 | TESTED | Missing/wrong symbols caught by review | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F017 | Scale calibration | U,S8,S14 | TESTED | Degenerate, rotated and inconsistent scales | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F018 | Linear measurements | U,S10,S14 | TESTED | Independent lengths and snap effects | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F019 | Point measurements | S8,S14 | TESTED | No duplicate points, saved quantities | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F020 | Area measurements | U,S8,S14 | TESTED | Analytic shapes and invalid polygons | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F021 | Zones and quantities | U,S1,S14 | TESTED | Boundary cases and schedule reconciliation | Partial zone/order allocation, persistence and workbook tests; reference boundary/tie parity, copying and full interaction acceptance remain unmet |
| F022 | Live zone totals | S4 | NOT STARTED | No stale or double-counted results | Update timing unspecified |
| F023 | Copy zones | U,S4 | NOT STARTED | Transforms and scope isolation | Scale handling requires observation |
| F024 | Coverage visualisation | S1,S16 | TESTED | Calibration and manual additions | Partial count-heading/point radius, calibrated page/floorplan circles, persistence, visibility and quantities tested; output drawings and complete reference parity absent |
| F025 | Connected length systems | S4 | NOT STARTED | Topology and totals after edits | Connection rules unknown |
| F026 | Automatic fittings | S4 | NOT STARTED | Known junction cases and edits | Fitting standards/types unspecified |
| F027 | Drops and risers | S4 | NOT STARTED | Horizontal/vertical totals reconcile | Elevation/quantity conventions unknown |
| F028 | Copy systems | S4 | NOT STARTED | Independent copies and fitting counts | Cross-drawing behavior unconfirmed |
| F029 | Measurement snapping | S4,S14 | NOT STARTED | Known-coordinate accuracy | Snapping switch observed; numerical tolerance unknown |
| F030 | Drawing overlays | U,S5,S14,S15 | TESTED | Position/reset/hide and source isolation | Multiple temporary layers, translation/visibility/opacity, tool isolation and cancellation tested; blue ink policy is original, rotation/scaling and full reference blending/chooser parity incomplete; overlays-2026-10-28.json |
| F031 | Floorplans | S5,S14,S15 | TESTED | Stable positions and navigation | Versioned same-discipline page groups, saved translation, hide/fit/navigation, rotation and source/quantity isolation tested; saved member annotations and owner-editor navigation tested; no group merge, member scaling or cross-sheet measure creation; floorplans/member-selection-review evidence |
| F032 | Revision comparison | U,S1,S14,S15 | TESTED | Known added/removed/changed geometry | Bounded red/blue/shared raster comparison, translation, cancellation and lifecycle tested on owned PDFs; automatic alignment, tolerance, transform/large-sheet corpus and recount missing; comparison-2026-10-28.json |
| F033 | Revision recount | U,S1,S21 | TESTED | Original retained; corrections traced | Explicit same-discipline target recount tested, atomic source-bound results/corrections/factors; automatic upload matching, replacement, cross-discipline copying and full reference parity absent |
| F034 | Quantity schedules | U | TESTED | Independent totals reconcile | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F035 | Takeoff Excel export | U,S1 | TESTED | Reopen and reconcile every total | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet |
| F036 | Output download lifecycle | S6,S14 | NOT STARTED | Stale outputs, repeat downloads, failure | Export and download control observed; output behavior untested |
| F037 | Dropbox/OneDrive output sync | S6 | NOT STARTED | Auth revocation, retries and duplicates | No integration credentials configured |
| F038 | Estimate quantity import | U,S2,S14 | NOT STARTED | Reconciliation and update handling | Optional takeoff import/default hourly rate observed; actual import untested |
| F039 | Historic price reuse | S2 | NOT STARTED | Provenance and unmatched items | Price matching policy unknown |
| F040 | Estimate organisation | S2 | NOT STARTED | Grouping/filtering leaves totals sound | Exact column types unknown |
| F041 | Margins/markups | S2 | NOT STARTED | Independent margin/markup arithmetic | Rounding/currency rules unspecified |
| F042 | Preliminaries | S2,S14 | NOT STARTED | Edits and repeated application | Type/category/name/markup/unit-buy columns observed; calculations untested |
| F043 | Price lists | S11,S14 | NOT STARTED | Invalid rows, units and updates | Catalogue-dependent import/maintenance deferred by user 2026-10-28; template/schema unexamined |
| F044 | Kits | S11,S14 | NOT STARTED | Component quantities and reuse | Catalogue-dependent kit management deferred by user 2026-10-28; composition/calculations untested |
| F045 | Estimate Excel quote | S2 | NOT STARTED | Prices/totals reopen accurately | Quote templates unknown |
| F046 | Specification comparison | S3,S14 | NOT STARTED | Known additions/deletions/amendments | Paired specification view and red/green change legend observed; correctness untested |
| F047 | Comparison PDF record | S3 | NOT STARTED | Changes and source identity retained | Exact report format unknown |
| F048 | Project sharing | S13 | NOT STARTED | Role isolation and conflicting edits | Private initial deployment; still required |
| F049 | Assignment/progress | S1,S8,S14 | NOT STARTED | Permissions and progress consistency | Project statuses observed; drawing assignment and roles untested |
| F050 | Cross-device cloud access | S13 | NOT STARTED | Version consistency and recovery | Local-first candidate does not satisfy |
| F051 | Sprinkler takeoff | U,S9 | NOT STARTED | Authorised labelled sprinkler corpus | Dedicated trade rules need specification |
| F052 | Hydrant takeoff | U | NOT STARTED | Labelled hydrant corpus and schedules | Dedicated Countfire capability unconfirmed |
| F053 | Electrical takeoff | U,S1 | NOT STARTED | Electrical symbol ground truth | Scope includes more than one symbol family |
| F054 | Mechanical takeoff | U,S10 | NOT STARTED | Mechanical fixtures and fittings | Trade units/rules require specification |
| F055 | General construction | U | NOT STARTED | Representative general fixtures | Dedicated reference module unconfirmed |
| F056 | Keyboard/tool workflow | S8,S14 | NOT STARTED | Focus, tool state and keyboard tests | Current tool shortcuts partially observed; complete mappings untested |
| F057 | Automatic project sorting | S4 | NOT STARTED | Discipline accuracy if feature ships | Coming soon, not confirmed available |
| F058 | Legend takeoff | S4 | NOT STARTED | Legend-to-symbol ground truth | Coming soon, not confirmed available |
| F059 | Remaining documented features | U,S12 | NOT STARTED | Trace sources to requirements/tests | Help index sparse; exhaustive audit pending |
| F060 | Drawing title extraction | S14 | NOT STARTED | Synthetic title-block accuracy and safe correction/cancellation | Control observed; extraction not executed |
| F061 | Product catalogue | S14 | NOT STARTED | Persistence, validation and independent labour/cost calculations | DEFERRED by user 2026-10-28 for later customisation; do not build catalogue UI or product-library management |
| F062 | Individual match reclassification | S15 | TESTED | Totals and colors update; original heading remains traceable | Partial: versioned reassignment, original IDs, audit, browser colours/totals and page keyboard queue tested; cross-page mode/global save and reference recount precedence unverified |
| F063 | Zone heading order | S15 | TESTED | Each interior point allocated once to first eligible heading; reorder reconciles | Partial zone/order allocation, persistence and workbook tests; reference boundary/tie parity, copying and full interaction acceptance remain unmet |
| F064 | Itemised measurements | S15 | NOT STARTED | Default aggregate and itemised rows reconcile; dominant-zone allocation tested | Equal zone split and exact workbook schema unknown |
| F065 | Check sheet outputs | S15 | NOT STARTED | Every accepted match traceable; corrections invalidate old outputs | Actual output layout and links untested |
| F066 | Quantity multiplier | S15 | TESTED | Independent arithmetic and scope tests after specification | Selection-linked factors, mixed quantities, safe migration, correction/reclassification preservation, audit, zones and export tested; manual factors/full reference limits and reassignment precedence unresolved |
| F067 | Measurement multiplier | S15 | TESTED | Length multiplication, calibration, persistence and invalid/stale edits | Partial length-only factors, audit and zone/export composition tested; area/point scope and reference bounds unresolved |
| F068 | Zone multiplier | S15 | TESTED | Cross-drawing quantity reconciliation, factor indication and red XLSX quantities | Partial heading factors, transactional audit and source-factor composition tested; numeric bounds and full reference save semantics unresolved |
| F069 | Floating references | S15 | NOT STARTED | Reference lifecycle and drawing interaction tests after specification | Only article title discovered; detailed behavior unresolved |
| F070 | Ignore classification | S15 | NOT STARTED | Ignored matches do not inflate quantities; reclassification recoverable | Only article title discovered; suppression scope unresolved |
| F071 | Symbols-removed output drawings | S15 | NOT STARTED | Original retained; suppression tied to correct accepted source instances | Output control linked in help; precise format/options unresolved |
| F072 | Saved selection review list | S15 | TESTED | Correct crop/rotation, source navigation, missing-source indication | Partial previews/source highlights, drawing-wide Matches/Multiplier/Total and classification reconciliation tested; saved vector operation counts, erase/restore and source-bound recount now tested; text/image decomposition and complete parity remain absent |
| F073 | Selection element editing | S15,S17 | TESTED | Edited template provenance and affected matches reconcile; cancel restores prior state | Partial vector-path editor, anchored recount, corrections/factors, atomic audit and cancel/reopen tested; row and empty-editor deletion with cross-drawing confirmation, audit and unused-heading pruning tested; text/image/clipping, clash ownership and exact decomposition remain unmet |
| F074 | Delete source selections | S18 | TESTED | Scoped removal, manual/other-example retention, stale snapshots, audit and export | Partial deletion/pruning tested; no undo, automatic overlapping-definition reassignment or global Save transaction |
| F075 | Move whole source selections | S19 | TESTED | Scope, versions, attribution, factors, corrections, conflicts and export audit | Partial drag/chooser and corrected recount tested; global Save, group hierarchy and complete reference edge parity remain unmet |
| F076 | Copy takeoff items | S22 | NOT STARTED | Independent copies, source isolation, scale/annotation mapping, empty-target checks | Current-beta modal categories/empty-target rule confirmed; execution, source retention and mapping still unverified |
| F077 | Replace revised drawing | S21 | NOT STARTED | Original provenance, geometry alignment, count corrections, invalid/multipage rejection | Current-beta Replace menu observed; source retention/recount execution remains unverified |

## Component and workflow map

| Modules | Responsibility / design risk |
| --- | --- |
| `index.html`, `app.mjs` | Shell, mutable shared context, event wiring, page lifecycle and refresh; preserve element/event contracts during migration. |
| `project-model.mjs`, `project-ui.mjs`, `drawing-picker.mjs` | Project list/filtering, hierarchy, drawing access; view preferences are not durable. |
| `takeoff-ui.mjs`, `count-headings.mjs`, `count-group-ui.mjs`, `count-groups.mjs` | Creation, classifications, groups, review and quantities share a long panel; scope is not sufficiently explicit. |
| `matcher.mjs`, `match-worker.mjs`, `recognize-drawing.mjs`, `drawing-recount.mjs` | Bounded image matching and explicit revision recount; no semantic recognition guarantee. |
| `selection-list.mjs`, `example-preview.mjs`, `selection-editor.mjs`, `pdf-elements.mjs` | Saved examples, source elements and preview/recount; element editing is not unrestricted PDF editing. |
| `selection-deletion.mjs`, `selection-movement.mjs` | Versioned source-selection lifecycle and modal impact/target selection; no general undo. |
| `coordinates.mjs`, `navigation.mjs`, `takeoff-geometry.mjs`, `measurement-editor.mjs` | PDF-space transforms, zoom/pan and analytic geometry; keyboard/non-drag precision editing incomplete. |
| `zone-ui.mjs`, server `zone-store.mjs`, `zone-allocation.mjs` | Polygon persistence, priority, clipping and schedule; outside-zone omission and overlap priority need stronger explanation. |
| `coverage.mjs`, `coverage-input.mjs`, server `coverage-store.mjs` | Calibrated coverage display; no engineering-compliance guarantee or complete annotated output. |
| `overlay-ui.mjs`, `overlay.mjs`, `comparison-ui.mjs`, `comparison.mjs` | Temporary view layers and bounded raster comparison; not automatic semantic revision understanding. |
| `floorplan-ui.mjs`, `floorplan-model.mjs`, `floorplan-annotations.mjs` | Saved member layout and owner-bound annotations; cross-sheet measurements/member scaling absent. |
| `server.mjs`, `store.mjs`, `project-store.mjs`, `takeoff-store.mjs`, factor/group/selection stores | HTTP validation, SQLite persistence, versions, audit, source-linked quantities; retain as authoritative contracts. |
| `workbook.mjs` | Server readiness gates, schedule/detail/factor/note/provenance output; UI must use same scope and quantities. |
| `style.css`, `projects.css`, `drawing-workspace.css` | Global layered styling, fixed offsets and overrides; no coherent semantic token system yet. |

## Current journey bottlenecks

Project → takeoff → discipline → upload is real and persistent, but large-list search and view restoration remain limited. Count → review requires scrolling past creation and grouping controls. Measurement → zone → export crosses different contexts with different save semantics. Export currently lives outside the active drawing workflow. Grouping and selection movement are usable but modal; overlapping-zone edits lack a clear before/after allocation view. The report maps each problem to a proposed interaction without changing the current calculation rules.
