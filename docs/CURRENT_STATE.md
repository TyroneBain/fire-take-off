# Current verified state — durable handover

Last meaningful session: 2026-10-22 (Australia/Sydney), authenticated Chrome research follow-up. Phase 0 is INCOMPLETE because REA setup and actual analysis remain blocked. Do not begin Countfire application development. Browser research prework has progressed; it does not close that gate.

## Repository and delivery

Local root: `/Users/tyronebain/Projects/fire-take-off`. Branch: `main`. Origin: `https://github.com/TyroneBain/fire-take-off.git`.

Authenticated GitHub connector confirms repository visibility PRIVATE and TyroneBain admin/push permission. Repository was empty before this work. Initial README published through the GitHub API at `4a733b80dabbbb7bd4ba0a16b3aebd59e44bcfd0`. The complete 26-file foundation batch was published at `57b1d2af0448726cc3ebd4520b298f3f30b8b0b0`, tree `fceefbea6df6b57d50b563529bb003a35da40a23`; GitHub readback confirmed 26 files and PRIVATE visibility. Both published commits and their trees were reproduced and hash-verified locally, with a clean worktree. This delivery handover is maintained in a following commit; use `git log -1` for its own final SHA. All foundation documentation, fixture and sanitised evidence are committed and delivered through the authenticated API. No shell push succeeded: shell Git cannot resolve github.com. Shell Git authentication is unverified; connector permissions do not establish shell credentials. gh and Homebrew are absent.

No existing repository files or unrelated work were overwritten. Project Git identity is derived from the authenticated account's observed initial commit; no global Git identity was changed.

## Finished

- Requested repository layout and placeholders; root AGENTS.md provides persistent start/session/verification/commit/handover rules.
- Product objective, eight-phase roadmap with exit criteria, development/testing rules and major decision log.
- Initial public inventory contained 59 features. Authenticated beta UI research expands it to 61 with title extraction and product catalogue requirements. Each entry retains source, workflow, status, acceptance requirements, limitation and priority; all product statuses remain NOT STARTED. Exhaustive research remains incomplete.
- Architecture comparison and recommendation, explicitly not adopted. No product scaffolding/dependencies or Countfire replacement development.
- Original dependency-free JavaScript fixture. Its 3 behavior tests pass.
- REA 6.7.0 runtime installed locally in ignored `.local/rea-runtime`, official archive and 149 dependency archive integrity checks passed; offline npm install succeeded with 146 packages. Optional native packages/apps were not installed.
- Official dry-run/setup/doctor and actual CLI fixture analysis attempted. Sanitised failed-result evidence and partial observation comparison saved. Follow-up Codex doctor remains unhealthy.
- Chrome DevTools MCP now connects to the authenticated beta Countfire session. Inspected normal project/create dialogs, demo takeoff/drawing tools, specification view and catalogue schemas. Saved 21 sanitised observations and an initial feature-linked workflow/acceptance matrix in WORKFLOW_SPECIFICATIONS.md. No proprietary source, private project identifiers, drawing assets or catalogue values saved; no persistent Countfire changes submitted.

## Incomplete, broken or blocked

1. REA setup: cannot back up protected `~/.codex/config.toml`; exit 1, `needs_human`, no applied actions. Registration and installed matching workflow remain missing. Codex doctor reports unhealthy.
2. Actual REA analysis: exit 1 `cleanup_incomplete`, child process inspection `spawn EPERM`. Seven structural checks on partial observations match owned source, but this is not a successful analysis. Direct permitted process inspection found no reported worker remaining.
3. Live REA tools absent from this session. Must configure successfully, restart Codex and perform actual fixture analysis through the active MCP tool before Phase 0 closes.
4. Chrome access is RESOLVED: active Chrome DevTools MCP tools reached authenticated beta Countfire. Research covered normal visible controls and demo navigation. Counting, measurements, correction, save/reload, export, estimating calculations and reference import behavior remain untested. No actual Countfire replacement has been built.
5. Shell npm/npx DNS and shell Git connectivity fail. Permitted curl downloads and the authenticated GitHub connector work. Shell credentials/push are unverified; do not claim a successful git push.
6. Countfire file limits, zone boundary/revision rules, workbook schemas, correction behavior and detailed estimating calculations remain unknown. Current visible controls are partially specified. Help centre discovery was sparse. Announced future features are not assumed shipped.
7. Asked asynchronously whether to retain the original REA gate or proceed without REA verification. No explicit waiver has been received at this handover; retain the original gate.

## Verification and evidence

- Git 2.50.1 (Apple Git-155); Node 24.22.0; npm 11.19.1; Codex CLI 0.163.0.
- `node --test fixtures/rea-smoke/app.test.mjs`: 3 passed, 0 failed.
- `node .local/rea-runtime/scripts/rea.mjs --version`: 6.7.0.
- `setup --client codex --dry-run --json`: planned, exit 0; `setup --client codex --yes --json`: needs_human, exit 1.
- `doctor --client codex --skill --json`: unhealthy, exit 1; skill/registration missing.
- `analyze-javascript-application .../fixtures/rea-smoke --json`: failed, exit 1; partial static observations compared with source, seven checks passed. No end-to-end success or live MCP verification.
- See [REA_SETUP](REA_SETUP.md) and the three JSON summaries under `docs/evidence/`. Raw outputs/runtime remain ignored under `.local/`.
- `.gitignore` confirmed exclusions for sample secrets, runtime, private drawings, uploads and exports. Documentation/link/status checks passed (13 required files, 5 directory groups, 14 local Markdown links, 59 complete/unique parity rows); staged whitespace review passed. GitHub foundation tree and local index hashes matched, and the worktree was clean after synchronisation. The delivery handover update is checked and published separately. Evidence is recorded in `docs/evidence/foundation-checks.json`.

## Authenticated browser session results

- Chrome tools successfully listed the Countfire tab and read its logged-in dashboard. Normal UI navigation confirmed project → takeoff → discipline → drawing, separate project estimates/specification comparisons, six drawing modes, point/length/area types, layout actions and title extraction.
- Creation/import/column dialogs were cancelled. No project, takeoff, estimate, mark, zone, catalogue value or upload was saved. No export was run.
- Reference research is beta-specific and proves observed UI presence/navigation only. The specification matrix proposes tests; none are claimed passed.
- Browser research files and current handover are delivered in the commit containing this update; use `git log -1` for the final SHA and verify remote head. Delivery uses the existing authenticated GitHub API workflow; shell Git push is still unverified.

## Roadmap and architecture

Phase 0 foundation → Phase 1 research/specification → Phase 2 PDF core → Phase 3 recognition/counting → Phase 4 measures/zones → Phase 5 revisions/advanced takeoff → Phase 6 schedules/estimating → Phase 7 full parity/performance acceptance.

Recommended candidates: TypeScript/React UI, PDF.js worker rendering, Canvas overlays, loopback Node service or later Electron packaging, SQLite plus immutable local files, independent CV worker with OpenCV benchmark, ExcelJS evaluation and behavior-focused test tooling. No stack decision accepted. See ARCHITECTURE and ADR-0003.

## Folder structure

```text
fire-take-off/
├── AGENTS.md
├── README.md
├── .gitignore
├── .editorconfig
├── docs/
│   ├── PRODUCT_VISION.md
│   ├── FEATURE_PARITY.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── CURRENT_STATE.md
│   ├── REA_SETUP.md
│   ├── DEVELOPMENT_RULES.md
│   ├── TEST_STRATEGY.md
│   ├── WORKFLOW_SPECIFICATIONS.md
│   └── evidence/
│       ├── rea-installation-summary.json
│       ├── rea-doctor-summary.json
│       ├── rea-analysis-summary.json
│       ├── foundation-checks.json
│       ├── countfire-ui-observations-2026-10-22.json
│       └── research-checks-2026-10-22.json
├── apps/.gitkeep
├── packages/.gitkeep
├── tests/.gitkeep
├── fixtures/rea-smoke/
│   ├── README.md
│   ├── package.json
│   ├── app.mjs
│   ├── calculation.mjs
│   └── app.test.mjs
└── .github/workflows/.gitkeep
```

`.git/` contains repository metadata. Ignored `.local/` contains this machine's diagnostic runtime and raw evidence. No CI workflow has been implemented.

## Exact next action

Complete the ordinary-Terminal setup/doctor/analysis commands in REA_SETUP, then `/quit` and launch `codex` from this repository. In the new session, read AGENTS and this file, verify REA via `/mcp`, inspect live identity and run the fixture analysis through its actual MCP tool. Save passing evidence and close Phase 0 only after every exit condition is met.

Initial matrix is now written in WORKFLOW_SPECIFICATIONS.md. Next research work: extend it with actual controlled behavior observations for project → import → select/count → review/correct → calibrate/measure/zone → revision → export → estimate. Resolve P0 unknowns and establish drawing provenance, numerical tolerances and performance budgets before choosing a stack or building product code.
