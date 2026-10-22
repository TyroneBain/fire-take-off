# Countfire workflow specifications — initial observed baseline

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

Observed 2026-10-22 through the user's authenticated Chrome using Chrome DevTools MCP. Reference: **beta.countfire.com**, not a claim that every production release behaves identically. Only normal user-visible controls, text and navigation were inspected. No application bundles, network payloads, proprietary source, cookies or credentials were extracted. Private project identifiers, customer data, catalogue prices and drawing content are excluded from this specification.

This Phase 1 research baseline now follows successful live REA verification. This document preserves the original research baseline. The local project/PDF core is now partially implemented and TESTED; no feature is VERIFIED. Every acceptance item below is a proposed test for our original implementation, not a test that has passed.

Evidence: [sanitised observation ledger](evidence/countfire-ui-observations-2026-10-22.json). B identifiers refer to that ledger. Controls were opened and cancelled, or tabs switched, without submitting changes. Opening a reference control proves its presence; it does not prove that its underlying operation succeeds.

## Workflow matrix

| Workflow | Parity IDs | Observed reference behavior | Proposed Fire Take Off acceptance criteria | Still unknown |
| --- | --- | --- | --- | --- |
| Project discovery | F001 | B001: Active, Own and Archived views; filter; project/customer/building type/owner/status/created/due columns | Create two synthetic projects; verify filter and owner/archive scopes; reopen without metadata loss | Full archive/restore actions, permissions and sorting |
| Create project | F001 | B002: modal has required Name plus Owner, Customer, Building type and Due date; Cancel/Create actions | Reject blank name; persist valid fields; cancel leaves no project; validation identifies invalid dates | Length/duplicate rules and owner permission model |
| Project lifecycle | F001,F049 | B003: Takeoff, Estimate, Client review, Won, Lost and On hold menu choices | Change an owned synthetic project's status, reopen and verify; cancelled menu does not change status | Allowed transitions, auditing and assignment permissions |
| Project contents | F001,F003 | B004: separate Takeoffs, Estimates and Specifications sections with create actions | Two takeoffs and separate estimates/comparisons remain under the same project without conflation | Copy/delete/revision linkage semantics |
| Create takeoff | F003 | B005: required name; revision-style suggested name; modal cancelled | Create two independently named takeoffs; validate and cancel without side effects | Revision numbering rules and copied content |
| Drawing organisation/import | F002,F003 | B006: takeoff groups drawing cards by discipline; each group offers PDF upload/drag-drop; New discipline and Export/download controls | Import a synthetic multipage PDF into selected discipline; persist original bytes; assign stable page IDs; reopen; corrupt import leaves existing drawings intact | Multipage splitting, limits, progress/failure UI and duplicate policy |
| Drawing opening | F004,F006 | B007: drawing selector includes discipline and drawing name; breadcrumbs return to takeoff/project; loading state then drawing content | Navigate between synthetic pages; retain correct page transforms and marks; expose load/error state; cancel stale renders | Selector options, keyboard paging, large-file budgets |
| Workspace state | F005,F056 | B008: Count, Measure, Zone, Note, Layout, Page tabs; Save changes disabled during untouched inspection | Switching tools does not create marks or dirty project; save only commits real edits; keyboard focus remains accessible | Unsaved-exit warning and autosave behavior |
| Select and auto-count | F008,F009,F010,F011 | B009: Count empty state instructs box-selection to count across drawings; Smart select and Add to current controls observed during loading | On our labelled synthetic corpus, select one example, inspect each proposed match, reconcile drawing totals, preserve provenance and reject duplicate detections | Actual matching behavior, discipline scope, tuning and naming accuracy; no selection was made |
| Background/visibility | F014,F015 | B010: global Hide Background switch; not toggled | Toggling visual layers must not silently change persisted quantities; review hidden matches without losing source coordinates | Current classification editor and scope; rendering response untested |
| Calibration | F017 | B010: global ratio-style Scale input becomes enabled after load; not edited | Set a known source length and unit; reject zero-length/invalid calibration; verify length/area independent of zoom; reopen preserves calibration | Supported units, ratio derivation and per-page propagation |
| Measurement types | F018,F019,F020 | B011: point, length and area choices; length selection changes Create action and exposes Snapping | Known independent point/line/polygon fixtures produce expected quantities; switching type creates nothing; invalid geometry rejected | Holes, overlaps, point metadata and tolerances |
| Connected systems | F025-F029 | Only snapping control observed in this pass; other capabilities retain public-documentation evidence | Verify connected topology, fitting classification, risers/drops and copying against independent reference cases | Full current systems UI and quantity rules need a dedicated authorised scratch takeoff |
| Zones | F021-F023 | B012: Zone empty state describes outlining areas to split quantities; Snapping visible | Before/after-count zones produce identical agreed allocations; overlapping/boundary cases follow documented rules; edits refresh totals | Copy controls, overlap ownership and numerical tolerances |
| Notes | F007 | B013: Note empty state describes cloud/annotation workflow | Add/edit/delete an original note; reopen and export; verify page-space attachment after zoom/rotation | Note editor, formatting, cloud shapes and output representation |
| Floorplans | F031 | B014: Layout → Floor plan → Add drawing; described as joining sheeted drawings | Align original synthetic sheets; verify saved positions and stable navigation without altering source geometry | Discipline restriction, persistence and transformations |
| Overlays | F030 | B014: Layout → Overlay → Add drawing; guidance mentions drawings from other disciplines or projects | Superimpose two owned sources, adjust/remove overlay and verify base counts unaffected | Current persistence and cross-project authorisation; no overlay added |
| Drawing comparison | F032,F033 | B014: Compare tab exists alongside Floor plan and Overlay | Known revision additions/removals visible; counts and overrides retain source-revision provenance | Compare panel details/recount behavior not inspected |
| Page metadata/extraction | F003,F060 | B015: Page → Name, Title and Extract titles controls | Rename/title one synthetic page; cancellation safe; extracted titles previewed and correctable before application | Extraction scope, algorithm, preview, confidence and error behavior |
| Export | F034-F037 | B006: Export and download action present on takeoff; not executed | Generate XLSX/record outputs from accepted synthetic quantities; independently reopen and reconcile by drawing/zone/item; report errors without stale success | Workbook schema, checksheets, invalidation and sync behavior |
| Create estimate | F038,F041 | B016: Name, optional existing takeoff search, default hourly rate; modal cancelled | Create without import or from approved takeoff snapshot; reconcile quantities; validate numeric rate; cancel leaves no estimate | Actual import update rules, estimate editor, currencies and rounding |
| Product catalogue | F061 | B017: filter; selectable columns for category/manufacturer/part code/description/material buy/labour hours/hourly rate | Persist original products; reject invalid prices/hours; search; toggle columns without data loss; independent labour calculation | Editing/import/locking, units, duplicates and rate precedence |
| Kits | F044 | B018: kit name, total labour hours, component quantity/labour and product identity columns | Build original multi-component kit; independently calculate components/labour; edit quantity and verify snapshot behavior | Nesting, reuse, multiplication/rounding and cost composition |
| Preliminaries | F042 | B019: type/category/name/markup-percent/unit-buy columns | Apply original prelim items once per intended scope; independent markup calculation; no duplicate application | Category rules, units and default behaviour |
| Price list import | F043 | B020: named CSV/Excel file upload; template link; Update catalogue initially checked; Upload disabled before required input | Validate synthetic CSV/XLSX mappings; preview or report row errors; transactional update; catalogue-update option respected | Exact template schema, mapping, conflicts, partial failure and rollback |
| Specification comparison | F046,F047 | B021: original/revised document pair; missing text red and new/revised text green | Compare original synthetic specification pair; assert known additions/deletions/amendments; export source-identifiable comparison | Matching tolerance, PDF output and scan/OCR behavior |

## Observation boundaries

- Project, takeoff, estimate, catalogue-column and price-list dialogs were viewed and cancelled. No Create, Upload, Save, Export or destructive action was submitted.
- Drawing tabs and measure-type controls were switched. The drawing loaded and text became accessible; visual fidelity, zoom/pan interaction, actual matches and numerical measurements were not tested.
- The demo project supplied drawing and specification screens. The organisation's live project content, drawings and rates were not copied into repository fixtures.
- No reference output file or template was downloaded. Schemas/formulas remain unknown.
- UI observation is separate from Fire Take Off implementation status. That observation pass predates implementation. Current states are maintained in FEATURE_PARITY.md.

## Next specification work

Phase 0 is complete. Continue the already authorised owned-scratch workflow with original synthetic PDFs, subject to the recorded browser upload restriction; routine research does not need renewed user permission. Specify correction precedence, zone boundaries, scale units/rounding, revision migration and export schemas before implementing those subsystems. Define small/medium/large corpus and measurable hardware-based performance targets. No architecture adoption follows merely from the observed interface.

## Original acceptance corpus follow-up

[Concrete cases A001–A011](ACCEPTANCE_CASES.md) map original synthetic geometry to independent expected quantities. [Corpus provenance](../fixtures/drawings/README.md) documents generation and remaining gaps. These are implementation requirements, not observed reference behavior or passed product tests.

## Public rule refinements and scratch research

See [REFERENCE_RULES](REFERENCE_RULES.md) for eight sourced article summaries and exact remaining questions. Zone order, itemisation, workbook structure and match reclassification now have documented requirements. These refine earlier unknowns without claiming live behavior. A synthetic scratch project/takeoff/discipline was created successfully; upload was denied by browser tool path access. No drawings, counts, measures or exports were created. All earlier no-write observations refer to the earlier session.

## Local core implementation follow-up

ADR-0008 stages research by subsystem after Phase 0. A001/A002 core subsets have passing automated tests for hierarchy, reopen, imports, rejection and removal. A003 has passing viewport transform checks plus browser zoom/rotation/page observation. This does not complete all listed acceptance criteria or validate Countfire parity. Evidence: [local core](evidence/local-core-2026-10-22.json). All other cases remain pending.

F007/A008 now has partial text-note implementation and passing CRUD/reopen/crop/zoom/rotation checks. Clouds, repositioning, note exports and unsaved-exit rules remain unimplemented. [Notes evidence](evidence/notes-2026-10-22.json) distinguishes browser observations from automated tests.

Manual F003 page Name/Title edits now save separately from immutable originals and survive reopen; Reset discards uncommitted field edits. Custom single-page names appear in cards and toolbar. F060 automatic title extraction remains NOT STARTED. Evidence: [page metadata](evidence/page-metadata-2026-10-22.json).

2026-10-22 follow-up: latest user reauthorised visible account inspection. Demo takeoff normal UI reconfirmed drawing selector, Count/Measure/Zone/Note/Layout/Page, Smart Select, Add to current and Hide Background. Loaded Measure showed Snapping checked, length type and Create length control. Attempt to open type control timed out; no type-menu behavior established. No count/measurement/export executed in the reference during this follow-up; no source/assets copied. Original local takeoff implementation is separate; see takeoff-loop evidence.
