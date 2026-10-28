# Executable acceptance planning

Standing user permission: [private functional and visual Countfire clone](AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

Phase 1 work, 2026-10-22. These cases specify our original application; they are not claims of tested Countfire behavior. Every product feature remains NOT STARTED. Fixture provenance and exact coordinates: [drawing corpus](../fixtures/drawings/README.md). No stack is adopted.

| Case | Parity IDs | Inputs/actions | Independent expected result | Unresolved prerequisite |
| --- | --- | --- | --- | --- |
| A001 | F001,F003 | Create projects A/B, two takeoffs in A, one discipline each; save/reopen | Stable IDs and independent names; A's content absent from B; blank name rejected; cancel creates nothing | Archive/restore and permission observation |
| A002 | F002,F006 | Import generated small-vector.pdf; reopen and switch drawings; import malformed bytes | Original SHA-256 retained; correct page dimensions; failed import leaves committed drawings intact | Duplicate/multipage limits and transactional UX |
| A003 | F004,F005 | Render fixture at two zooms and 90-degree rotation; place a mark at (100,100) | Inverse view transform recovers original coordinate; source geometry unchanged | Renderer benchmark and numerical tolerance agreement |
| A004 | F008,F009,F010,F016 | Select square-cross example; count fixture; review each match | Six labelled instances, no duplicate IDs, totals reconcile to six; report false positives and misses separately | Scope/correction reference workflow; performance targets |
| A005 | F013,F014 | Reject one match, manually restore one mark, hide/show layer; save/reopen | Five then six quantities; visibility alone changes no quantity; decision provenance survives reopen | Undo and recount correction precedence |
| A006 | F017,F018,F020 | Calibrate (50,400)→(350,400) to 30 m; measure run/rectangle | 50 m run; 100 m² area; zero/negative/nonfinite calibration rejected; zoom does not alter quantities | Reference units and rounding; tolerance agreement |
| A007 | F021,F034 | Draw fixture zone before and after counting; save/reopen | Six interior symbols both orders; schedule equals drawing total | Boundary, overlapping and cross-zone length rules require separate cases |
| A008 | F007 | Add note at original coordinate; edit/cancel/delete/reopen | Page attachment stable; cancelled edit retains original text; deletion persists | Reference formatting/export representation |
| A009 | F032,F033 | Use future labelled revision pair; recount after manual correction | Original revision retained and changes traceable; no silent correction loss | Revision pair and migration policy not yet defined |
| A010 | F034,F035 | Export six accepted fixture symbols and known measurements | Independently parsed workbook reconciles quantity 6, length 50 m and area 100 m² | Reference output schema and workbook inspection |
| A011 | F038,F041,F061 | Import approved quantity 6, set original unit buy 12.50 and labour 0.25 h at 100/h | Material 75.00; labour 1.5 h / 150.00 before adjustments | Currency, rate precedence, margins/markup and rounding policy |

All cases require environment/date, fixture SHA, commands or UI steps, observed results and failures before a feature can be VERIFIED. A001–A011 have not run. They refine existing parity requirements without waiving roadmap gates.

## Additional sourced cases

| Case | Parity IDs | Inputs/actions | Independent expected result | Unresolved prerequisite |
| --- | --- | --- | --- | --- |
| A012 | F063,F021 | Outer zone contains six symbols; inner zone contains only (100,100); swap heading order | Inner first: 1 inner / 5 outer. Outer first: 0 inner / 6 outer. No duplicate allocation | Boundary cases separately specified; no live reference execution |
| A013 | F062,F013 | Move one of six matches from heading A to B; save/reopen | A=5, B=1, total=6; origin retained; colors reflect destination | Recount/undo precedence |
| A014 | F064,F018,F020 | Two runs of 30 m and 20 m under one heading; toggle itemisation | Aggregate 50 m; itemised 30 m and 20 m plus total 50 m | Exact workbook rows and equal cross-zone split |
| A015 | F032,F033 | Compare original and revision fixture with six symbols each | Remove (100,100), add (350,150), retain five; equal totals must not hide changes | Revision transform/migration specification |
| A016 | F065,F016,F036 | Generate review outputs; reclassify one match and save | Earlier output identified as stale; regenerated evidence agrees with five/one split | Output schema/lifecycle |

A012–A016 are proposed and have not run in Fire Take Off. Their sources are in [REFERENCE_RULES](REFERENCE_RULES.md).

### A017 — Additional examples and classification (partial TESTED, 2026-10-23)

Use owned examples and independently declared symbol coordinates. Add another example to the same heading: new matches appear once, repeated results do not duplicate, exclusions and reclassification survive. Reject stale example/destination/version/scope atomically. Move an instance A→B→C→A while retaining ID/origin and conserved totals, then export and reconcile original/current IDs and audit. Rename/recolour without changing quantities. Reopen schema 5 data as schema 6. Browser: Add to current, R/Tab/Shift+Tab/numbers/Escape, original-heading text and colour/count updates. Evidence and remaining reference gaps: [count classification](evidence/count-classification-2026-10-23.json).

### A018 — Selection quantity multiplier (partial TESTED, 2026-10-27)

Use different source selections under one heading with x6/x2 factors and a manual instance. Raw marks remain distinct; weighted quantities, inclusion/reclassification, zones and workbook values reconcile independently. Invalid/stale factors and audit persistence failure leave saved state unchanged. Migrate old multi-example data without guessing ownership; a failed rerun must roll back attribution and a successful real run must preserve corrections. Evidence: [count multipliers](evidence/count-multipliers-2026-10-27.json). Full reference bounds/manual/reclassification-factor behavior remains unverified.

A019 — Length/zone multipliers (partial TESTED, 2026-10-28): 30 m length x2 split equally into West x5/East x2 yields 210 m; selection x6 in West yields 30 items; area 100 m² in West yields 500 m². Unoutlined pages keep zone factor one. Assert migration, rollback, stale edits, source geometry, audit and independent workbook XML/color evidence. See [quantity factors](evidence/quantity-factors-2026-10-28.json).

A020 — Project lifecycle (partial TESTED, 2026-10-28): create/edit local metadata and valid dates, traverse six statuses, filter/sort Active/Own/Archived, archive/restore and reopen without altering child entities, drawing bytes or quantities. Force metadata/audit failures and stale edits to prove atomicity. Browser create/cancel/edit/filter/status/archive/restore passed. See [projects](evidence/projects-2026-10-28.json); full user roles and reference pixel parity remain unresolved.

### A019 — Persistent same-discipline floorplans (partial TESTED, 2026-10-28)

Join owned original/revision/cropped-rotated pages, align and cancel/save changes, navigate to another member and reopen. Stable common positions, native note/measurement/mark coordinates and workbook snapshot must survive. Reject cross-discipline, stale, invalid, duplicate and group-merging changes without partial writes; forced audit failure must roll back even drawing deletion. Removing a companion prunes singleton groups without deleting source sheets. Test whole-view rotation/UserUnit with independent rectangular bounds and saved-state isolation while panning in count mode. Evidence: [floorplans](evidence/floorplans-2026-10-28.json). Group merging, member scale, all-sheet annotations and cross-sheet measurements remain out of this tested subset.
