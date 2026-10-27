# Feature parity inventory

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

Baseline researched 2026-10-22. Project/PDF, counting, measurements, zones and exports have partial tested scopes; individual rows record current status. No full parity claim is made. This inventory is detailed but provisional, not an exhaustive parity certification.

Statuses: NOT STARTED → IN DEVELOPMENT → IMPLEMENTED → TESTED → VERIFIED; BLOCKED records a real blocker with recovery action. VERIFIED requires relevant passing acceptance evidence. P0/P1/P2 indicate implementation order, not exclusions.

Descriptions summarise capability; workflows and tests below are proposed Fire Take Off requirements, not assertions about Countfire internals or exact UI behavior. U denotes explicit user scope. Source claims need normal authorised UI confirmation. Historical controls may have changed. September 2026 items labelled coming soon remain unconfirmed. Partial passing evidence does not establish full feature or interface parity.

## Sources

- U: User project foundation requirements: User instruction, 2026-10-22; requested scope, not evidence of Countfire behavior
- S1: [Takeoff](https://www.countfire.com/product/takeoff-software)
- S2: [Estimate](https://www.countfire.com/product/estimating-software)
- S3: [Specification comparison](https://www.countfire.com/product/specification-comparison)
- S4: [September 2026 updates](https://www.countfire.com/whats-new)
- S5: [Floorplans and overlays — historical](https://feedback.countfire.com/changelog/floor-plans-and-overlays)
- S6: [Export/download](https://feedback.countfire.com/changelog/export-and-download-outputs)
- S7: [Background controls — historical](https://feedback.countfire.com/changelog/background-control)
- S8: [April 2025 workflow guide — historical](https://www.countfire.com/blog/new-takeoff-experience)
- S9: [Fire sprinkler sector](https://www.countfire.com/fire-sprinkler-estimating-software)
- S10: [Mechanical sector](https://www.countfire.com/mechanical-estimating-software)
- S11: [FAQ: pricing setup](https://www.countfire.com/us/faq)
- S12: [Help centre entry point](https://help.countfire.com/en/)
- S13: [Public homepage](https://www.countfire.com/)

- S14: [Authorised beta UI observations, 2026-10-22](WORKFLOW_SPECIFICATIONS.md) — control presence and navigation only; not implementation evidence.

- S15: [Public help rules and article links, read 2026-10-22](REFERENCE_RULES.md) — documented behavior, not executed beta results.

## Inventory

| ID | Feature | Description | Evidence | Required workflow (proposed) | Status | Acceptance/testing requirements | Known limitations | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F001 | Project management | Create and resume takeoff projects | U,S2,S14 | Create, name, reopen and archive project | TESTED | Persistence, isolation, archive recovery | Basic name/create/reopen/filter tested; archive, metadata, assignment and restore remain missing; evidence local-core-2026-10-22.json | P0 |
| F002 | Drawing upload/storage | Store construction PDF sources | U,S1,S14 | Import PDFs and reopen saved set | TESTED | Corrupt files, duplicates, missing sources | Import/source integrity and rejection tests pass; 25 MiB/200-page local limits; native picker and encrypted-file acceptance untested; evidence local-core-2026-10-22.json | P0 |
| F003 | Drawing organisation | Organise by discipline/floor | U,S8,S14 | Assign drawing metadata and browse groups | TESTED | Isolation and ordering survive reopen | Hierarchy and page name/title editing tested; entity rename, reorder and floor grouping remain missing; evidence local-core-2026-10-22.json | P0 |
| F004 | High-resolution PDF viewer | Render drawings accurately | U | Open vector and scanned sheets | TESTED | Fiducials, text, linework, large sheets | PDF.js vector/raster and rotated/cropped browser render observed; large-sheet fidelity and performance budgets unverified; evidence local-core-2026-10-22.json | P0 |
| F005 | Zoom/pan | Navigate without altering geometry | U,S8 | Zoom to detail and pan back | TESTED | Pointer coordinates invariant under transforms | Zoom, fit width, rotation and scroll panning observed; pointer-centered zoom and saved view state missing; evidence local-core-2026-10-22.json | P0 |
| F006 | Page/drawing navigation | Switch active drawing/page | U,S8,S14 | Choose another page while retaining context | TESTED | State isolation and loading transitions | Ten-page next navigation observed; reopen data tested; keyboard paging and view-context persistence missing; evidence local-core-2026-10-22.json | P0 |
| F007 | Annotations/notes | Attach drawing notes | U,S1,S14 | Place, edit and remove note | TESTED | Reopen, transforms and export inclusion | Text note create/edit/delete, cancel, reopen and crop/zoom/rotation anchors tested; clouds, repositioning and export missing; evidence notes-2026-10-22.json | P0 |
| F008 | Symbol example selection | Define an example for matching | U,S1,S14 | Choose example and matching scope | TESTED | Selection bounds and scope separation | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F009 | Automatic symbol counts | Find repeated symbols | U,S1,S14 | Run detection and review instances | TESTED | Ground-truth precision/recall and duplicates | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F010 | Cross-drawing counts | Aggregate across drawing sets | U,S1 | Apply definition across selected drawings | TESTED | Totals reconcile by drawing/floor | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F011 | Smart Select | Suggest names and groups | U,S4,S14 | Select item then review suggested label | NOT STARTED | Editable names, mistaken classifications | Smart select control observed; no trained model or measured naming accuracy | P1 |
| F012 | Symbol groups/headings | Manage count classifications | S8 | Create headings/groups and edit membership | TESTED | Rename/delete and quantity reconciliation | Partial: name/colour editing and individual membership tested; heading deletion and group hierarchy absent; count-classification evidence | P0 |
| F013 | Manual corrections | Correct misses and false positives | U,S1 | Accept, reject or add individual marks | TESTED | Undo/reopen preserves corrected totals | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F014 | Matched-item visibility | Expose uncounted material | S8 | Hide/show selected or all matched marks | TESTED | Visibility does not mutate quantities | Partial per-heading/global overlay-marker controls and filter tested without saved-state mutation; underlying source-element suppression still absent | P0 |
| F015 | Background classification | Suppress distracting drawing content | S7,S14 | Customise background then restore/reset | NOT STARTED | Discipline scope and grey-symbol retention | Hide Background switch observed; current classification behavior untested | P1 |
| F016 | Takeoff verification | Review evidence behind quantities | U,S1 | Inspect every counted instance before approval | TESTED | Missing/wrong symbols caught by review | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F017 | Scale calibration | Map page distances to real units | U,S8,S14 | Set known distance and units | TESTED | Degenerate, rotated and inconsistent scales | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F018 | Linear measurements | Measure connected drawing runs | U,S10,S14 | Trace run and inspect length | TESTED | Independent lengths and snap effects | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F019 | Point measurements | Record individual measure points | S8,S14 | Create named points and count | TESTED | No duplicate points, saved quantities | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P1 |
| F020 | Area measurements | Compute bounded polygon area | U,S8,S14 | Draw boundary and inspect area | TESTED | Analytic shapes and invalid polygons | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F021 | Zones and quantities | Split results by zone | U,S1,S14 | Draw zones before/after counting | TESTED | Boundary cases and schedule reconciliation | Partial zone/order allocation, persistence and workbook tests; reference boundary/tie parity, copying and full interaction acceptance remain unmet | P0 |
| F022 | Live zone totals | Refresh quantities during edits | S4 | Edit active zone and observe totals | NOT STARTED | No stale or double-counted results | Update timing unspecified | P1 |
| F023 | Copy zones | Reuse zone definitions | U,S4 | Copy zones between selected sheets | NOT STARTED | Transforms and scope isolation | Scale handling requires observation | P1 |
| F024 | Coverage visualisation | Display device coverage | S1 | Set radius and inspect coverage | NOT STARTED | Calibration and manual additions | No claim of regulatory certification | P1 |
| F025 | Connected length systems | Maintain linked measures | S4 | Draw/edit a connected system | NOT STARTED | Topology and totals after edits | Connection rules unknown | P1 |
| F026 | Automatic fittings | Derive bends/tees/reducers | S4 | Draw branches and review fittings | NOT STARTED | Known junction cases and edits | Fitting standards/types unspecified | P1 |
| F027 | Drops and risers | Include vertical run components | S4 | Add vertical measures on drawing | NOT STARTED | Horizontal/vertical totals reconcile | Elevation/quantity conventions unknown | P1 |
| F028 | Copy systems | Duplicate connected measures | S4 | Copy/paste a whole measured system | NOT STARTED | Independent copies and fitting counts | Cross-drawing behavior unconfirmed | P1 |
| F029 | Measurement snapping | Align measures precisely | S4,S14 | Snap endpoints while measuring | NOT STARTED | Known-coordinate accuracy | Snapping switch observed; numerical tolerance unknown | P0 |
| F030 | Drawing overlays | View drawings superimposed | U,S5,S14 | Add other discipline and align | NOT STARTED | Position/reset/hide and source isolation | Layout Overlay includes cross-project guidance; persistence/permission behavior untested | P1 |
| F031 | Floorplans | Stitch related drawing views | S5,S14 | Position sheets in shared floor view | NOT STARTED | Stable positions and navigation | Layout Floor plan control observed; alignment/persistence untested | P1 |
| F032 | Revision comparison | Inspect drawing changes | U,S1,S14 | Align original and revised drawings | NOT STARTED | Known added/removed/changed geometry | Layout Compare tab observed; comparison/recount behavior untested | P1 |
| F033 | Revision recount | Reuse definitions on revisions | U,S1 | Import revision then review new counts | NOT STARTED | Original retained; corrections traced | Migration/matching constraints unknown | P1 |
| F034 | Quantity schedules | Summarise approved quantities | U | Group by drawing, item and zone | TESTED | Independent totals reconcile | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F035 | Takeoff Excel export | Export quantity breakdown | U,S1 | Export approved schedule to workbook | TESTED | Reopen and reconcile every total | Partial original implementation; see takeoff-loop evidence. Full reference acceptance and realistic corpus remain unmet | P0 |
| F036 | Output download lifecycle | Generate downloadable outputs | S6,S14 | Export then retrieve current package | NOT STARTED | Stale outputs, repeat downloads, failure | Export and download control observed; output behavior untested | P1 |
| F037 | Dropbox/OneDrive output sync | Deliver exported files to storage | S6 | Connect account then export/sync | NOT STARTED | Auth revocation, retries and duplicates | No integration credentials configured | P1 |
| F038 | Estimate quantity import | Transfer takeoff quantities | U,S2,S14 | Create estimate from accepted snapshot | NOT STARTED | Reconciliation and update handling | Optional takeoff import/default hourly rate observed; actual import untested | P1 |
| F039 | Historic price reuse | Reuse prior item prices | S2 | Review reused prices and override | NOT STARTED | Provenance and unmatched items | Price matching policy unknown | P1 |
| F040 | Estimate organisation | Configure columns/groups/filters | S2 | Restructure estimate without losing values | NOT STARTED | Grouping/filtering leaves totals sound | Exact column types unknown | P1 |
| F041 | Margins/markups | Control project and item pricing | S2 | Apply adjustments then review quote | NOT STARTED | Independent margin/markup arithmetic | Rounding/currency rules unspecified | P1 |
| F042 | Preliminaries | Reuse setup costs | S2,S14 | Configure prelims then apply to bid | NOT STARTED | Edits and repeated application | Type/category/name/markup/unit-buy columns observed; calculations untested | P1 |
| F043 | Price lists | Set up estimating prices | S11,S14 | Import and maintain authorised price list | NOT STARTED | Invalid rows, units and updates | CSV/Excel upload and Update catalogue option observed; template/schema unexamined | P1 |
| F044 | Kits | Group estimating components | S11,S14 | Define kit then price quantities | NOT STARTED | Component quantities and reuse | Kit/component/labour columns observed; composition/calculations untested | P1 |
| F045 | Estimate Excel quote | Export itemised client bid | S2 | Export priced estimate workbook | NOT STARTED | Prices/totals reopen accurately | Quote templates unknown | P1 |
| F046 | Specification comparison | Review PDF specification changes | S3,S14 | Compare versions and inspect differences | NOT STARTED | Known additions/deletions/amendments | Paired specification view and red/green change legend observed; correctness untested | P1 |
| F047 | Comparison PDF record | Save specification change evidence | S3 | Export comparison as PDF | NOT STARTED | Changes and source identity retained | Exact report format unknown | P1 |
| F048 | Project sharing | Work across estimators | S13 | Share project with authorised teammate | NOT STARTED | Role isolation and conflicting edits | Private initial deployment; still required | P1 |
| F049 | Assignment/progress | Assign drawing work and track state | S1,S8,S14 | Assign scope and update drawing status | NOT STARTED | Permissions and progress consistency | Project statuses observed; drawing assignment and roles untested | P1 |
| F050 | Cross-device cloud access | Resume work across supported clients | S13 | Open same project on Mac/PC | NOT STARTED | Version consistency and recovery | Local-first candidate does not satisfy | P1 |
| F051 | Sprinkler takeoff | Support sprinkler drawing workflow | U,S9 | Count heads and measure associated runs | NOT STARTED | Authorised labelled sprinkler corpus | Dedicated trade rules need specification | P0 |
| F052 | Hydrant takeoff | Support requested hydrant workflow | U | Count hydrants and measure routes | NOT STARTED | Labelled hydrant corpus and schedules | Dedicated Countfire capability unconfirmed | P0 |
| F053 | Electrical takeoff | Support electrical quantities | U,S1 | Count equipment and measure cable routes | NOT STARTED | Electrical symbol ground truth | Scope includes more than one symbol family | P0 |
| F054 | Mechanical takeoff | Support mechanical quantities | U,S10 | Measure pipe/duct systems and count items | NOT STARTED | Mechanical fixtures and fittings | Trade units/rules require specification | P0 |
| F055 | General construction | Support requested general takeoff | U | Count and measure general drawing items | NOT STARTED | Representative general fixtures | Dedicated reference module unconfirmed | P1 |
| F056 | Keyboard/tool workflow | Efficient tool and view switching | S8,S14 | Switch tools and navigate with shortcuts | NOT STARTED | Focus, tool state and keyboard tests | Current tool shortcuts partially observed; complete mappings untested | P1 |
| F057 | Automatic project sorting | Announced drawing organisation | S4 | Future: classify imported drawing set | NOT STARTED | Discipline accuracy if feature ships | Coming soon, not confirmed available | P2 |
| F058 | Legend takeoff | Announced legend-based counting | S4 | Future: select legend then inspect matches | NOT STARTED | Legend-to-symbol ground truth | Coming soon, not confirmed available | P2 |
| F059 | Remaining documented features | Expand inventory without omissions | U,S12 | Review help centre and authorised UI | NOT STARTED | Trace sources to requirements/tests | Help index sparse; exhaustive audit pending | P1 |
| F060 | Drawing title extraction | Extract and edit page metadata | S14 | Open Page, extract titles and review edits | NOT STARTED | Synthetic title-block accuracy and safe correction/cancellation | Control observed; extraction not executed | P1 |
| F061 | Product catalogue | Maintain product identity, material and labour rates | S14 | Filter products, configure columns and maintain original records | NOT STARTED | Persistence, validation and independent labour/cost calculations | Columns observed; editing/calculation behavior untested | P1 |

| F062 | Individual match reclassification | Move a match to a different heading with origin retained | S15 | Review matches, change heading, save and reopen | TESTED | Totals and colors update; original heading remains traceable | Partial: versioned reassignment, original IDs, audit, browser colours/totals and page keyboard queue tested; cross-page mode/global save and reference recount precedence unverified | P0 |
| F063 | Zone heading order | Allocate overlaps using discipline heading priority | S15 | Reorder overlapping zone headings, save and export | TESTED | Each interior point allocated once to first eligible heading; reorder reconciles | Partial zone/order allocation, persistence and workbook tests; reference boundary/tie parity, copying and full interaction acceptance remain unmet | P0 |
| F064 | Itemised measurements | Export individual measures and their totals | S15 | Toggle itemisation per heading and regenerate workbook | NOT STARTED | Default aggregate and itemised rows reconcile; dominant-zone allocation tested | Equal zone split and exact workbook schema unknown | P0 |
| F065 | Check sheet outputs | Generate inspectable evidence for automatic counts | S15 | Generate, review, correct and regenerate check sheets | NOT STARTED | Every accepted match traceable; corrections invalidate old outputs | Actual output layout and links untested | P0 |
| F066 | Quantity multiplier | Apply documented count multiplication | S15 | Set multiplier then review and export quantities | NOT STARTED | Independent arithmetic and scope tests after specification | Article linked by public collection; full rules not yet read | P1 |
| F067 | Measurement multiplier | Apply documented measure multiplication | S15 | Set measure multiplier and regenerate totals | NOT STARTED | Independent length/area/point multiplication and persistence | Article linked by public collection; units and scope unresolved | P1 |
| F068 | Zone multiplier | Apply documented zone multiplication | S15 | Set multiplier on zone heading and export | NOT STARTED | Quantity reconciliation and visible multiplier indication | Composition with other multipliers and rounding unresolved | P1 |
| F069 | Floating references | Use documented reference view while taking off | S15 | Open reference while selecting items | NOT STARTED | Reference lifecycle and drawing interaction tests after specification | Only article title discovered; detailed behavior unresolved | P1 |
| F070 | Ignore classification | Classify examples as ignored material | S15 | Create Ignore heading and inspect resulting matches/output | NOT STARTED | Ignored matches do not inflate quantities; reclassification recoverable | Only article title discovered; suppression scope unresolved | P1 |
| F071 | Symbols-removed output drawings | Produce drawings with counted symbols suppressed | S15 | Generate drawing record and review remaining material | NOT STARTED | Original retained; suppression tied to correct accepted source instances | Output control linked in help; precise format/options unresolved | P1 |
| F072 | Saved selection review list | Inspect each source example | S15 | Expand a heading, inspect thumbnail, navigate to source selection | TESTED | Correct crop/rotation, source navigation, missing-source indication | Partial previews/source highlights tested; elements, per-selection match counts and multiplier columns absent | P0 |
| F073 | Selection element editing | Clean unwanted elements from examples | S15 | Manage selection, erase/restore elements, recalculate results | NOT STARTED | Edited template provenance and affected matches reconcile; cancel restores prior state | Public editing-selections article read; no element model or editor implemented | P0 |

## Phase 1 questions

Resolve document/page limits, supported units, revision migration, zone overlap rules, detector scope, output schemas, kit/labour details, pricing rounding, roles and concurrent edits. Audit help articles and normal authorised workflows; record source URLs and dates without private account data. Confirm current behavior where 2022/2025 documentation conflicts with September 2026 changes. Determine whether announced features have shipped before treating them as available reference functionality.

Acceptance planning now includes [cases A001–A011](ACCEPTANCE_CASES.md) and an [original drawing corpus](../fixtures/drawings/README.md). Feature statuses remain unchanged; fixture generation is not product implementation.

Partial takeoff-loop scope: F008–F010 same-scale/orientation example matching across up to 20 pages; F013 inclusion corrections/manual additions with audit; F016 explicit review; F017–F020 calibrated points/lengths/simple polygons; F034–F035 original XLSX with reviewed/scaled quantities, no zones. Tests: 27/27 including prior core/REA checks. Evidence: [takeoff loop](evidence/takeoff-loop-2026-10-22.json). None implies complete parity.

F014 source visibility subset: Hide drawing hides/restores only the PDF canvas while preserving six current-page overlays and identical saved state (78 total marks). This earlier scope is superseded by 2026-10-27 overlay-marker controls below; Countfire source-element suppression/background classification remain incomplete.

Zone evidence: [zones-2026-10-22](evidence/zones-2026-10-22.json), 34/34 total suite tests. F022 remains incomplete: saved edits recompute totals, continuous drag preview is absent. F023 copy remains NOT STARTED; F064 dominant-zone itemisation remains NOT STARTED. F034–F035 now support separate zone columns but exact workbook/rounding parity remains unverified.

Count classification evidence: [2026-10-23](evidence/count-classification-2026-10-23.json), 42/42 suite tests. F008 supports multiple source-bound examples per heading and Add to current (2). F012 adds name/colour editing; hierarchy/deletion remain absent. F062 retains original/current identities through repeated reclassification, with R/Tab/number-key page review. F013 corrections survive additional matching. F034/F035 export original/current IDs and heading changes. No full parity claim.

Example review evidence: [2026-10-27](evidence/example-review-2026-10-27.json), 43/43 tests. Saved-example previews and native source highlighting expand F008/F072; F014 overlay-marker visibility/filtering leaves complete API state unchanged. Full source-element hiding, element editing, per-example attribution and multiplier columns remain unmet. The inventory now contains 73 requirements; this discovery expands scope without promoting full parity.
