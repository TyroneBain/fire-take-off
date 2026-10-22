# REA setup — not fully verified

Last checked 2026-10-22. Phase 0 remains open. No REA tool is exposed in this active Codex session, the default Codex registration and matching installed workflow are missing, and actual CLI analysis returned an error. Partial analysis observations are not a successful end-to-end test.

## Official references consulted

- [morluto/rea](https://github.com/morluto/rea)
- [Official installation/setup guide](https://github.com/morluto/rea/blob/main/docs/installation.md)
- [Published package](https://www.npmjs.com/package/rea-agents)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

Use Codex-specific setup and doctor commands. The official guide distinguishes registration checks from live tools and offers static JavaScript analysis without a native engine. Setup supports an explicit client scope and preserves unrelated configuration. Recheck current official documentation before future changes.

## Observed installation

Git 2.50.1 (Apple Git-155), Node 24.22.0, npm 11.19.1, Codex CLI 0.163.0. gh, Homebrew and a global rea executable are absent. Node satisfies the published REA requirement `^22.19.0 || ^24.11.0 || >=26.0.0`.

Shell npm/npx requests fail with ENOTFOUND for registry.npmjs.org. Permitted curl downloads work. Downloaded official rea-agents 6.7.0 and the upstream main package-lock (also 6.7.0); checked every direct dependency specification matches the published package. The upstream lockfile is a mutable source, not a release tag: a v6.7.0 lockfile URL returned 404. Verified the REA archive against the official registry SHA-512 and all 149 downloaded production dependency archives against lockfile integrity hashes. Installed offline with lifecycle scripts and optional/dev dependencies disabled; npm reported 146 installed packages and exit 0. Earlier pruned-lock install attempts failed and were corrected by restoring the complete upstream lockfile.

Runtime is local and ignored: `.local/rea-runtime/`. This is diagnostic tooling, not a product dependency. It is not a globally installed package and will not arrive with a fresh clone. Frida and optional native providers were not installed. No Hopper/Ghidra/IDA application was installed.

`node .local/rea-runtime/scripts/rea.mjs --version` returned `6.7.0`.

## Configuration attempt

Before setup, `codex mcp list` returned no configured servers. REA dry-run proposed only:

1. Add REA to `/Users/tyronebain/.codex/config.toml`, backing it up to `config.toml.rea.backup`.
2. Install bundled instructions/references under `/Users/tyronebain/.agents/skills/reverse-engineer-anything`.

Applied the explicit authorised Codex scope with `setup --client codex --yes --json`. Result: exit 1, status `needs_human`, client failure reason `backup`, no applied actions. The execution profile grants read access to protected Codex/agents directories and setup could not create the required backup. No unrelated configuration was intentionally edited. No broken configuration was replaced or bypassed.

Official health check:

```bash
node .local/rea-runtime/scripts/rea.mjs doctor --client codex --skill --json
```

Exit 1; `healthy: false`, registration missing, installed skill missing, live server unknown. Package expects workflow version 42 and advertises 207 MCP tools; an advertised catalog count does not establish callable tools in this session. Bundled workflow is available in the downloaded package, but installation/agent loading is unverified.

## Owned fixture test

Original application: `fixtures/rea-smoke/`. It imports a calculation module, exports a quote summary and prints a known result. Node behavior tests passed 3/3, including invalid inputs. REA command:

```bash
node .local/rea-runtime/scripts/rea.mjs analyze-javascript-application \
  /Users/tyronebain/Projects/fire-take-off/fixtures/rea-smoke --json
```

Exit 1: `cleanup_incomplete`. REA reported `process table could not be inspected: spawn EPERM` while checking worker PID 39127. A separate permitted direct `ps` inspection found no such worker or REA JavaScript analysis process; this does not retroactively turn REA's cleanup result into success.

The error carries a partial observation. Compared it against source: all three JavaScript files recognised; expected exports and app-to-calculation import recovered; zero Electron windows/preloads and zero parse failures. Seven comparison checks passed. REA did not execute code or prove runtime arithmetic; independent Node tests supplied that ground truth. This is partial static evidence only, not a successful CLI or live MCP test.

## Saved evidence

- [Installation summary](evidence/rea-installation-summary.json)
- [Official doctor summary](evidence/rea-doctor-summary.json)
- [Failed analysis and observation comparison](evidence/rea-analysis-summary.json)

Raw local outputs remain in ignored `.local/rea-plan.json`, `rea-setup.json`, `rea-doctor.json`, `rea-analysis.json`; the version-controlled records are selected, sanitised evidence with actual exit states, not raw-report replacements. No account data, credentials or third-party application code is included.

## One-command recovery from ordinary Terminal

A fresh repair attempt after Chrome connected still failed: setup exit 1 (`needs_human`, backup failure, no applied actions); owned-fixture analysis exit 1 (`cleanup_incomplete`, child process inspection `spawn EPERM`). A permitted direct process check found no REA JavaScript analysis worker remaining. These restrictions were not bypassed, and native applications were not installed.

Run the prepared helper from ordinary macOS Terminal:

```bash
cd ~/Projects/fire-take-off
bash scripts/repair-rea.sh
```

It uses the existing tested local runtime, or pinned official `rea-agents@6.7.0` if that runtime is absent. It plans and applies only the authorised Codex setup, checks the installed workflow/registration, runs our fixture tests and attempts actual CLI analysis. It stops on failure and retains reports under ignored `.local/rea-recovery.*`. It does not use sudo, install optional native applications or mark Phase 0 complete.

Verified here: Bash syntax and `--plan-only` execution pass, and the official plan reports zero applied actions. Successful full execution outside the restricted session has **not** been observed. See [recovery evidence](evidence/rea-recovery-attempt-2026-10-22.json). After the helper succeeds, start a fresh `codex` session from this repository and perform the live MCP verification described below.

## Detailed recovery and restart

Run these from an ordinary macOS Terminal with access to your own Codex configuration (outside this restricted session):

```bash
cd /Users/tyronebain/Projects/fire-take-off
node .local/rea-runtime/scripts/rea.mjs setup --client codex --dry-run --json
node .local/rea-runtime/scripts/rea.mjs setup --client codex --yes --json
node .local/rea-runtime/scripts/rea.mjs doctor --client codex --skill --json
node .local/rea-runtime/scripts/rea.mjs analyze-javascript-application \
  /Users/tyronebain/Projects/fire-take-off/fixtures/rea-smoke --json
```

The local runtime is present on this machine. On a fresh clone, use the official pinned package runner `npx -y rea-agents@6.7.0` in place of `node .local/rea-runtime/scripts/rea.mjs` after normal npm connectivity is restored. Do not install native providers for this test.

Review the dry-run before applying. If setup/analysis succeeds, exit the current Codex CLI with `/quit`, then start a fresh session:

```bash
cd /Users/tyronebain/Projects/fire-take-off
codex
```

In that session, use `/mcp` to confirm REA is connected, read its installed workflow, call `binary_session` to establish the live identity, and invoke the advertised JavaScript application analysis tool on our fixture using its actual schema. Compare the result to fixture source, save evidence and update this document/CURRENT_STATE. If operating from a desktop client, fully restart that client as well. A restart alone will not fix the currently missing registration. Phase 0 cannot close until these checks succeed.

Follow-up on 2026-10-22: Chrome DevTools MCP is registered with `npx -y chrome-devtools-mcp@latest --autoConnect` and active browser tools successfully reached the authenticated beta Countfire dashboard. Normal UI observation is documented in WORKFLOW_SPECIFICATIONS.md. This browser connection does not install or verify REA. A fresh official `doctor --client codex --skill --json` still returned exit 1, unhealthy, missing registration/skill, and no REA tools are exposed. Raw follow-up report is ignored at `.local/rea-doctor-followup.json`. No renewed analysis attempt was made.
