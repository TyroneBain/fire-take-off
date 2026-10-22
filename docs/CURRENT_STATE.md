# Current verified state — durable handover

Last meaningful session: 2026-10-22 (Australia/Sydney). Phase 0 COMPLETE. Phase 1 research and Phase 2 core are IN DEVELOPMENT under the sequencing change in ADR-0008. The first local app now works; complete Countfire parity remains far from finished. F001–F010, F013, F016–F020, F021, F063, F034–F035 have TESTED partial scopes, with limitations; no product feature is VERIFIED.

## Repository and delivery

Root `/Users/tyronebain/Projects/fire-take-off`; branch `main`; origin `https://github.com/TyroneBain/fire-take-off.git`. Core increment published as `f92e19931a1f71e241238a88e626f0f7446a49da` and notes as `92dca0d73b79753cb9b97f5e858c9ad5f948fc93`; exact local tree/commit hashes reproduced and local main reconciled. Prior local/remote commit/tree match was observed. Repository must remain PRIVATE. Shell Git has no usable credentials; use authenticated GitHub API with expected-head protection, never force-push or replace remote changes.

Page metadata was published and reconciled at `f9b71f5e1523a7f38089ba000a3d49269a577b5b` (tree `94d115813fc7bc3f19f5e5c9fc919f48dc07d284`). The takeoff increment was published as `935838695131042a5d007e5f8a2031e67ebf3b33`, tree `e47a5e7df67f820ce1160096d5ecc99fad55a80b`, using GitHub API expected-head protection. Exact local tree/commit reconstructed and main advanced from the checked prior SHA. Sandbox Git object/ref writes initially failed; permitted reruns succeeded. This handover follow-up records that delivery; its final commit is available in git log.

## Run the application

`npm ci --ignore-scripts`, then `npm start`; open http://127.0.0.1:4173. Node 24.22.x required. The app is running from this session on loopback port 4173. Stop with Ctrl-C in its terminal or stop the owned server process. Data lives in ignored `.local/app/`; retain the whole directory. Optional `FIRE_TAKE_OFF_DATA` selects another store; `PORT` selects another port. No deployment or public hosting was performed.

## Finished in this increment

- Documented ADR-0008 BEFORE implementation: allow the reversible project/PDF core after completed Phase 0 while reference behavior research continues. No full Phase 1 completion or parity waiver. Adopted native browser modules, Node loopback service, built-in SQLite and PDF.js 6.4.299. Earlier React/TypeScript recommendations remain unadopted alternatives.
- Original workspace interface creates and filters projects, creates takeoffs and disciplines, lists drawings and removes drawing records with confirmation.
- SQLite hierarchy/drawing metadata persist across reopen. Immutable source PDFs are hashed and checked when read; shared-source deletion preserves other drawings. Sources are retained after record removal; retention/garbage collection is not implemented.
- PDF import: 25 MiB / 200-page local limits, isolated parsing with 256 MiB old-space / 20-second timeout, at most two concurrent parsers, corrupt-input and duplicate rejection. Limits are our provisional capacities, not Countfire facts or accepted performance budgets.
- PDF.js worker viewer: vector/raster display, page navigation, fit width, zoom, quarter-turn rotation and scroll panning. Original crop/rotation geometry retained; backing canvas capped at 16 million pixels. No text layer or persisted view context yet; plain-text notes are now implemented.
- Installed pinned dependency and committed lockfile; lifecycle scripts disabled. PDF.js optional @napi-rs/canvas 1.0.13 installed from npm. Dependency licences/notices documented in THIRD_PARTY.md. Audit reported zero advisories.

## Verification and evidence

Core report: 12 passed, 0 failed. Final suite after page metadata: 18 passed, 0 failed (15 product tests and 3 unchanged owned-fixture tests). Includes reopen/persistence, bad input, duplicates/concurrency, source integrity, drawing removal, viewport fiducials/inversion and actual HTTP/token/origin behavior. Browser UI hierarchy creation and persisted reopen observed. Four original PDFs imported through our real API; browser rendered vector, raster, rotated/cropped and ten-page inputs, and navigated page 1→2. Zoom/rotation worked. Final raster browser console had no errors/warnings after the WebAssembly policy fix. Evidence: `docs/evidence/local-core-2026-10-22.json`.

Initial failures are retained in evidence: SQL placeholder mismatch corrected; removed PDF.js document cleanup API replaced with loading-task cleanup; sandbox loopback and audit DNS denied then permitted reruns passed; screenshot-file path denied, inline screenshot reviewed; initial raster ICC/WebAssembly warning fixed. Scroll anchoring was disabled and new drawing/page opens reset pan. Final code also resets removal-dialog return value and closes the viewer when creating a different entity.

Native OS picker upload remains unautomated because the browser MCP rejects workspace file paths. Our API intake and browser rendering were tested independently; no reference-tool boundary was bypassed. Password-protected files, realistic large sheets, crash recovery, full accessibility and performance budgets remain untested. No tests establish full parity.

## Earlier foundation and research preserved

REA live MCP 6.7.0 passed against owned fixture with aligned workflow 42, seven source checks and 3/3 behavior tests. Full evidence/limitations remain in `docs/evidence/rea-live-mcp-2026-10-22.json`; no need to repeat repair. Phase 0 was delivered at `53de3e8580c3a8d003c9ae6f75bd915dd29c760b`.

Original independent PDFKit corpus includes raster, rotated/cropped, repeated 10/100-page and six-to-six revision variants. See `docs/evidence/drawing-corpus-2026-10-22.json`; repeated geometry is not representative construction performance. Eight sourced help rules, 71 parity requirements and 16 proposed acceptance cases remain maintained.

The authorised reference scratch project `Fire Take Off synthetic research 2026-10-22`, takeoff `Rev 0`, empty discipline `Synthetic fixture` remain in Countfire. Reference upload was denied by the browser tool; no reference count/measurement/export ran. No unrelated project edited; no assignments/messages sent. Public help research is separate from application acceptance.

## Takeoff loop implemented and tested

ADR-0010 precedes implementation: schema 4 persists count items/examples, source-bound match instances, versioned inclusion/review decisions with append-only correction events, calibrations and native PDF point/length/polygon geometry. Browser workers execute our bounded original binary-overlap matcher; cancellation/failure commits no partial run. Scope can cover one drawing or all discipline drawings. Manual additions, exclusion/restoration, page/item batch review and next-unchecked navigation work. Same size/orientation only; this is not Smart Select or general recognition.

Point/length/area creation and known-length scale calibration support m/mm/ft/in input and produce metres/metres². Unscaled quantities remain unknown. Recalibration recomputes measures. Invalid/crossed/degenerate geometry and stale versions are rejected. Source PDFs stay immutable.

ExcelJS 4.4.0 produces an original snapshot workbook with overview, drawing list, notes, instances, review history and discipline count/measure rows. Export refuses pending included marks and unscaled measures. Snapshot hash now includes definitions, calibrations and review provenance. UUID advisory fixed with scoped 11.1.1 override; audit then zero advisories. Transitive dependency deprecation notices remain. Workbook UI/API transport observed; automated ExcelJS and independent Python ZIP/XML readers reconcile quantities and literal strings.

Final repeated `npm test`: 27 passed, 0 failed (24 product, 3 REA diagnostic). Earlier workbook test helper failed due to missing directory return, then corrected. Browser found 78 owned-fixture matches (6 vector + 6 raster + 6 cropped/rotated + 60 ten-page), exclusion/restoration 78→77→78, cancellation left no committed results. Pointer-selected calibration gave 50.013506 m and 100.134554 m², reflecting endpoint quantization; domain tests independently establish exact analytic 50 m / 100 m². Evidence: `docs/evidence/takeoff-loop-2026-10-22.json`.

Latest user explicitly reauthorised normal Countfire account analysis. Demo takeoff inspected through visible UI only; no source, bundles, customer drawings or account data copied into Git. The newer source-copy request does not establish a Countfire code licence; continue independently implementing behavior. The earlier overnight prohibition on authenticated inspection is superseded by the later explicit access instruction.

## Zone increment (prepared; delivery pending)

ADR-0011 precedes implementation. Schema 5 persists discipline headings/order/version and page outlines. Same-heading outlines union; first heading wins overlaps; pages with no outlines contribute whole-page quantities, outlined pages exclude outside. Counts/points allocate once; lengths split at boundary intersections; areas use polygon-clipping 0.15.7 union/difference/intersection, including concave and derived-hole cases. Boundary ties go to first eligible heading as an explicit original provisional policy, not a measured Countfire fact.

Zone UI creates headings and outlines, reorders/deletes headings, deletes outlines, edits vertices/whole outlines with Save/Cancel, and implements node insertion/removal and right-click completion. Totals recompute after saved operations, not continuously while dragging. Source instances/geometry stay intact. Workbook discipline sheets now contain separate zone quantity columns with reconciled row totals. Only allocated included marks require review and only allocated unscaled measures block output. No-zone output stays compatible.

Final suite: 34/34 passed (31 product + 3 owned REA diagnostics). Includes analytic 15/5 m and 150/50 m² crossing allocations, six-symbol overlap/edge cases, concavity/holes, scope/version errors, schema 4 migration/reopen, real HTTP routes and workbook columns. Earlier failures: schema 5 absent from version whitelist, migration test cleanup double-close, test HTTP helper sending empty JSON on DELETE; fixed before final run. Initial npm dependency install DNS denied; permitted install succeeded with zero advisories. Browser: West/East counts 4/2→2/4 on reorder; vertex saved near [75,50] at version 2; cancelled edit preserved full API state. Raw 78 marks retained. Evidence: `docs/evidence/zones-2026-10-22.json`.

Two demonstration headings/outlines remain on Original.pdf in ignored local data, East first then West. Other fixture pages have no zones. App remains running on 4173; session 82302 loaded initial zone server, but latest workbook pivot and request-validation changes require a restart before manual live export verification. Automated tests run fresh code. `caffeinate -i` runs in session 23172 as explicitly requested.

Parent local/remote baseline `81ebfd25e4a2f3ab8d14c394f0fcc15073ae9f5d`, tree `2bdf4ace5999ffa6fcfb238a1ed59334339abe74`. Zone increment is currently uncommitted/unpublished. Preserve all changes. User explicitly requests NO further approval prompts; use permitted actions. If publication or local reconciliation is sandbox-blocked, retain exact recovery steps rather than claiming delivery. Shell Git auth remains unavailable; API delivery needs expected-head protection.

## Incomplete / next executable task

Deliver the tested zone increment; if local Git object/ref writes are blocked, preserve the index/files and record the remote SHA/tree for later hash-verified reconciliation. Restart the owned loopback server in a session already permitted to bind port 4173, then verify workbook download with zone columns. Continue zone gesture acceptance, keyboard pan/delete, live drag previews, copying, multipliers and itemisation; do not mark complete zone parity. Next counting work: multiple examples, reclassification and stronger matching benchmarks.

Full Smart Select, revisions, connected systems/fittings, estimating and cloud collaboration remain absent. Same-size/orientation matching, 20-page/4M-pixel limits remain provisional. No full feature is VERIFIED. Original implementation uses visible/public behavior; no Countfire source or assets copied.

## Evidence and storage

README gives reproducible run/test commands. ARCHITECTURE, ROADMAP, DECISIONS, TEST_STRATEGY, WORKFLOW_SPECIFICATIONS and FEATURE_PARITY reflect ADR-0008 and the partial core. Local raw fixture PDFs/images, DB, source uploads and runtime stay ignored under `.local/`; no private drawings or credentials are tracked. Product code is under `apps/local/`, tests under `tests/local-app.test.mjs`; no CI or distributable installer yet.


## Persisted notes follow-up

ADR-0009: schema 2 transactionally migrates schema 1; notes store drawing/page/native PDF x/y/plain text/version. Create/edit/delete, cancelled edit/removal, stale version rejection, reopen and drawing-deletion cascade have passing tests. Browser created a note on the rotated/cropped fixture, preserved coordinates through zoom/rotation/edit/reload, exercised cancel/removal, and retained one demonstration note. No browser errors/warnings observed. Evidence: `docs/evidence/notes-2026-10-22.json`.

The base generator preserves its original PDF digest; added portable cropped/rotated fixture variant. A staged whitespace check found one extra EOF blank line in the preceding core stylesheet (the earlier unstaged check omitted untracked files); fixed now. Browser reconnected mid-session and page IDs changed; live page listing recovered the app. No private browser data was committed. Notes are partial F007 TESTED; cloud shapes, repositioning, exports and unsaved-exit handling remain incomplete. Service remains active at the same loopback URL; data retains earlier drawings and a note.


## Page panel follow-up

Schema 3 adds versioned page names/titles, migrates existing schema 1/2 data and commits imported drawing/page rows atomically. Manual Name/Title editor, Reset, reopen and card/toolbar labels passed browser checks while the original source and existing note remained intact. Automatic extraction stays NOT STARTED. Final `npm test`: 18/18 passed with loopback permission; preceding sandbox run failed only HTTP bind (17/18). Evidence: `docs/evidence/page-metadata-2026-10-22.json`. Browser app remains open and running at the same loopback URL. Full UI/workflow parity is not complete.
