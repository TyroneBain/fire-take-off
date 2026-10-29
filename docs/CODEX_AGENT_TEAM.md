# Codex specialist team — 2026-10-30

The **main Codex session is the lead engineer/orchestrator**; it owns task allocation, architecture decisions, merges, and final acceptance. Specialist agents are advisory or narrow-scope implementers, not autonomous competing leads. This is a project configuration, not evidence that agents are running.

## Start order
1. **Vector engineer**: immediately inspect our code with REA and implement the smallest independent vector matching improvement.
2. **QA benchmark**: independently prepare tests and report evidence in parallel; do not edit the same files as vector engineer.
3. **Multi-trade MEP workflow**: supply short estimator acceptance scenarios across electrical, lighting, fire, security/alarms, data/AV and mechanical, starting with fire.
4. **Apple designer**: review and draft UX recommendations only, no production changes until recognition benchmark.
5. **Estimating/Excel**: deferred until counting benchmark is demonstrated.

## Lead operating contract
- Read AGENTS.md and docs/COUNTING_COMPETITIVE_EXECUTION_PLAN_2026-10.md; inspect git status and preserve unpushed/local changes before any pull/merge.
- Delegate independent, bounded tasks; max four active threads. One writer per code area. Do not let agents overwrite each other's files.
- Use REA to analyze our repository, not to access Countfire's hidden implementation.
- Countfire access is for normal permitted UI observation only, subject to applicable terms. Independently engineer matching; no copied source, hidden APIs, decompilation or proprietary assets.
- Require explicit tests, file diffs, fixture provenance, before/after quantities, and regression checks before accepting changes.
- No claims of parity without real-drawing precision/recall, false-positive correction cost, timing and reconciled exports.
- Report: current gate, delegated agents, verified changes, test results, blockers, next executable action.

## Invocation
Codex versions differ in multi-agent availability. The project-scoped `.codex/config.toml` defines role names and config files; confirm the installed Codex version recognizes this syntax and has multi-agent support enabled. If not, treat these role descriptions as instructions for the lead agent until supported. Do not assume agents launch automatically. Keep the main session as coordinator.

## Specialist knowledge base
All non-design specialists must read `docs/AGENT_TECHNICAL_REFERENCE.md` and verify the current official references relevant to each task. Apple designer reads `docs/design/APPLE_HIG_AGENT_REFERENCE.md`. These are curated source indexes and acceptance contracts, not training weights or proof that external sources have been reviewed. The lead checks source versions, benchmark evidence and implementation before accepting work.

## Competitive intelligence
The competitive_analyst agent studies Countfire, Groundplan and other takeoff products from dated public sources and permitted normal UI observation. It reports evidence, unknowns, benchmarkable gaps and small actionable proposals to the lead. It is research-only and must not interrupt the vector-engineering and QA priority or copy proprietary implementations.

## Current operating strategy (2026-10-30)
Read `docs/ENGINEERING_QUALITY_STRATEGY.md` first for acceptance gates, benchmark fixtures, data integrity, failure register and local agent verification. All eight custom agents must include `name`, `description`, and `developer_instructions`. The current specialist roles also include `competitive_analyst`, `data_integrity` and `performance_reliability`. Keep four or fewer concurrent specialist threads and only one writer per code area. Agent role definitions are not evidence of execution; verify locally in a new Codex session.
