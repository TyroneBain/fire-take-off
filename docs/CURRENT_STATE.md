# Current verified state — durable handover

Last meaningful session: 2026-10-22 (Australia/Sydney). Phase 0 COMPLETE. Phase 1 research and Phase 2 core are IN DEVELOPMENT under the sequencing change in ADR-0008. The first local app now works; complete Countfire parity remains far from finished. F001–F007 are TESTED for partial scope, with limitations; no product feature is VERIFIED.

## Repository and delivery

Root `/Users/tyronebain/Projects/fire-take-off`; branch `main`; origin `https://github.com/TyroneBain/fire-take-off.git`. Core increment published as `f92e19931a1f71e241238a88e626f0f7446a49da`; exact local tree/commit hashes reproduced and main reconciled before notes work. Prior local/remote commit/tree match was observed. Repository must remain PRIVATE. Shell Git has no usable credentials; use authenticated GitHub API with expected-head protection, never force-push or replace remote changes.

The notes follow-up is prepared for API delivery with parent `f92e19931a1f71e241238a88e626f0f7446a49da`. After publication/reconciliation, `git log -1` gives its final SHA; read remote ref back and confirm clean worktree. If delivery fails, retain all files/index, create the new tree over the parent tree, create commit with that parent, update main with expected SHA, reproduce exact commit/tree objects locally and advance local main only when hashes match.

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

Core report: 12 passed, 0 failed. Final suite after notes: 16 passed, 0 failed (13 product tests and 3 unchanged owned-fixture tests). Includes reopen/persistence, bad input, duplicates/concurrency, source integrity, drawing removal, viewport fiducials/inversion and actual HTTP/token/origin behavior. Browser UI hierarchy creation and persisted reopen observed. Four original PDFs imported through our real API; browser rendered vector, raster, rotated/cropped and ten-page inputs, and navigated page 1→2. Zoom/rotation worked. Final raster browser console had no errors/warnings after the WebAssembly policy fix. Evidence: `docs/evidence/local-core-2026-10-22.json`.

Initial failures are retained in evidence: SQL placeholder mismatch corrected; removed PDF.js document cleanup API replaced with loading-task cleanup; sandbox loopback and audit DNS denied then permitted reruns passed; screenshot-file path denied, inline screenshot reviewed; initial raster ICC/WebAssembly warning fixed. Scroll anchoring was disabled and new drawing/page opens reset pan. Final code also resets removal-dialog return value and closes the viewer when creating a different entity.

Native OS picker upload remains unautomated because the browser MCP rejects workspace file paths. Our API intake and browser rendering were tested independently; no reference-tool boundary was bypassed. Password-protected files, realistic large sheets, crash recovery, full accessibility and performance budgets remain untested. No tests establish full parity.

## Earlier foundation and research preserved

REA live MCP 6.7.0 passed against owned fixture with aligned workflow 42, seven source checks and 3/3 behavior tests. Full evidence/limitations remain in `docs/evidence/rea-live-mcp-2026-10-22.json`; no need to repeat repair. Phase 0 was delivered at `53de3e8580c3a8d003c9ae6f75bd915dd29c760b`.

Original independent PDFKit corpus includes raster, rotated/cropped, repeated 10/100-page and six-to-six revision variants. See `docs/evidence/drawing-corpus-2026-10-22.json`; repeated geometry is not representative construction performance. Eight sourced help rules, 71 parity requirements and 16 proposed acceptance cases remain maintained.

The authorised reference scratch project `Fire Take Off synthetic research 2026-10-22`, takeoff `Rev 0`, empty discipline `Synthetic fixture` remain in Countfire. Reference upload was denied by the browser tool; no reference count/measurement/export ran. No unrelated project edited; no assignments/messages sent. Public help research is separate from application acceptance.

## Incomplete / next executable task

Next implement editable page/drawing metadata and original manual point/length/area workflows with explicit calibration and units, plus behavior tests against analytic fixtures. Continue viewer cancellation/recovery and representative performance observations. Build original automatic symbol example/match/review against labelled fixtures after its policies are specified.

Project rename/archive/metadata, drawing/floor organisation, text/search, cloud annotations/note repositioning and exports, automatic recognition/Smart Select, manual corrections, calibration, points/lengths/areas, zones, overlays/revisions, schedules/Excel, estimating/kits/pricing, integrations and cloud collaboration remain incomplete. Full Phase 1 baseline, realistic trade corpus and accepted tolerances/budgets remain obligations. See FEATURE_PARITY for exact status and scope.

## Evidence and storage

README gives reproducible run/test commands. ARCHITECTURE, ROADMAP, DECISIONS, TEST_STRATEGY, WORKFLOW_SPECIFICATIONS and FEATURE_PARITY reflect ADR-0008 and the partial core. Local raw fixture PDFs/images, DB, source uploads and runtime stay ignored under `.local/`; no private drawings or credentials are tracked. Product code is under `apps/local/`, tests under `tests/local-app.test.mjs`; no CI or distributable installer yet.


## Persisted notes follow-up

ADR-0009: schema 2 transactionally migrates schema 1; notes store drawing/page/native PDF x/y/plain text/version. Create/edit/delete, cancelled edit/removal, stale version rejection, reopen and drawing-deletion cascade have passing tests. Browser created a note on the rotated/cropped fixture, preserved coordinates through zoom/rotation/edit/reload, exercised cancel/removal, and retained one demonstration note. No browser errors/warnings observed. Evidence: `docs/evidence/notes-2026-10-22.json`.

The base generator preserves its original PDF digest; added portable cropped/rotated fixture variant. A staged whitespace check found one extra EOF blank line in the preceding core stylesheet (the earlier unstaged check omitted untracked files); fixed now. Browser reconnected mid-session and page IDs changed; live page listing recovered the app. No private browser data was committed. Notes are partial F007 TESTED; cloud shapes, repositioning, exports and unsaved-exit handling remain incomplete. Service remains active at the same loopback URL; data retains earlier drawings and a note.
