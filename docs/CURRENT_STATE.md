# Current verified state — durable handover

Last meaningful session: 2026-10-22 (Australia/Sydney). Phase 0 is INCOMPLETE because REA setup and actual analysis remain blocked. Do not begin Countfire application development.

## Repository and delivery

Local root: `/Users/tyronebain/Projects/fire-take-off`. Branch: `main`. Origin: `https://github.com/TyroneBain/fire-take-off.git`.

Authenticated GitHub connector confirms repository visibility PRIVATE and TyroneBain admin/push permission. Repository was empty before this work. Initial README published through the GitHub API at `4a733b80dabbbb7bd4ba0a16b3aebd59e44bcfd0`; that commit was reproduced and hash-verified locally. Foundation batch publication is pending at this handover revision. No shell push succeeded: shell Git cannot resolve github.com. Shell Git authentication is unverified; connector permissions do not establish shell credentials. gh and Homebrew are absent.

No existing repository files or unrelated work were overwritten. Project Git identity is derived from the authenticated account's observed initial commit; no global Git identity was changed.

## Finished

- Requested repository layout and placeholders; root AGENTS.md provides persistent start/session/verification/commit/handover rules.
- Product objective, eight-phase roadmap with exit criteria, development/testing rules and major decision log.
- Detailed sourced inventory of 59 feature entries, each with description, evidence, workflow, status, testing requirement, limitation and priority. All product statuses NOT STARTED. Exhaustive research remains Phase 1 work.
- Architecture comparison and recommendation, explicitly not adopted. No product scaffolding/dependencies or Countfire replacement development.
- Original dependency-free JavaScript fixture. Its 3 behavior tests pass.
- REA 6.7.0 runtime installed locally in ignored `.local/rea-runtime`, official archive and 149 dependency archive integrity checks passed; offline npm install succeeded with 146 packages. Optional native packages/apps were not installed.
- Official dry-run/setup/doctor and actual CLI fixture analysis attempted. Sanitised failed-result evidence and partial observation comparison saved.

## Incomplete, broken or blocked

1. REA setup: cannot back up protected `~/.codex/config.toml`; exit 1, `needs_human`, no applied actions. Registration and installed matching workflow remain missing. Codex doctor reports unhealthy.
2. Actual REA analysis: exit 1 `cleanup_incomplete`, child process inspection `spawn EPERM`. Seven structural checks on partial observations match owned source, but this is not a successful analysis. Direct permitted process inspection found no reported worker remaining.
3. Live REA tools absent from this session. Must configure successfully, restart Codex and perform actual fixture analysis through the active MCP tool before Phase 0 closes.
4. Local Chrome control is not exposed. No logged-in Countfire account inspection was performed. Plugin discovery found a cloud browser, which does not establish access to this Chrome profile. Public website research completed; private UI observations remain pending.
5. Shell npm/npx DNS and shell Git connectivity fail. Permitted curl downloads and the authenticated GitHub connector work. Shell credentials/push are unverified; do not claim a successful git push.
6. Countfire limits, current controls, zones/revisions/export schemas and detailed estimating behavior remain explicit unknowns. Help centre discovery was sparse. Announced future features are not assumed shipped.

## Verification and evidence

- Git 2.50.1 (Apple Git-155); Node 24.22.0; npm 11.19.1; Codex CLI 0.163.0.
- `node --test fixtures/rea-smoke/app.test.mjs`: 3 passed, 0 failed.
- `node .local/rea-runtime/scripts/rea.mjs --version`: 6.7.0.
- `setup --client codex --dry-run --json`: planned, exit 0; `setup --client codex --yes --json`: needs_human, exit 1.
- `doctor --client codex --skill --json`: unhealthy, exit 1; skill/registration missing.
- `analyze-javascript-application .../fixtures/rea-smoke --json`: failed, exit 1; partial static observations compared with source, seven checks passed. No end-to-end success or live MCP verification.
- See [REA_SETUP](REA_SETUP.md) and the three JSON summaries under `docs/evidence/`. Raw outputs/runtime remain ignored under `.local/`.
- `.gitignore` confirmed exclusions for sample secrets, runtime, private drawings, uploads and exports. Documentation/link/status checks and whitespace review run before foundation publication; their evidence is recorded separately.

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
│   └── evidence/
│       ├── rea-installation-summary.json
│       ├── rea-doctor-summary.json
│       ├── rea-analysis-summary.json
│       └── foundation-checks.json
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

Then Phase 1: author a feature-ID-linked workflow/acceptance specification matrix for project → import → select/count → review/correct → calibrate/measure/zone → revision → export → estimate, using public help articles and normal authorised UI observations. Resolve P0 unknowns and establish drawing provenance, numerical tolerances and performance budgets before choosing a stack or building product code.
