# Fire Take Off — execution and quality strategy
Owner strategy updated 2026-10-30. This is the current cross-agent operating standard, not evidence that benchmarks have already passed.

## North star
Build the fastest trustworthy, independently engineered, drawing-first multi-trade construction takeoff workflow. Measure estimator outcomes: correct quantities, time to reviewed export, correction effort, understandable uncertainty and reliable saved state. Never equate a large feature list with product quality.

## Scope and sequence
**Now: sprinkler vector-symbol proof.** Use REA on our own repository to trace PDF operations, extraction, candidate matching, corrections, persistence, zones and export. Choose the smallest viable vector matching increment with raster fallback. Test on owner-authorised fire drawing sets with independently confirmed symbol-instance ground truth. Do not redesign UI or expand into six trade engines first.
**Next: repeatable benchmarks and integrity.** Establish baseline counts, TP/FP/FN, precision, recall, false positives per sheet, median correction actions, total estimator minutes, p50/p95 match time, peak memory and Excel reconciliation. Compare to owner-authorised Countfire workflow where permitted, using equivalent drawings/tasks.
**Then: trade-neutral expansion.** Electrical, lighting, security/fire alarms, data/AV, mechanical. Reuse core matcher, build discipline-specific legend interpretation, symbol examples, units and acceptance fixtures. Add Apple-inspired workflow polish only after a tested core path.
**Later: commercial readiness.** Recovery, security/privacy, onboarding, revisions, collaboration, supported environments, release packaging and pilot feedback.

## Definition of done — counting feature
1. User can open an authorised vector PDF, choose a symbol, remove interfering linework if supported, run counting, inspect marked instances and correct misses/false positives.
2. Reviewed quantities survive save/reopen and any tested revision path; zone allocation and Excel export reconcile exactly.
3. Independent QA records per-sheet/type ground truth and TP/FP/FN, precision/recall, latency and correction effort. Separate synthetic tests, authorised real-drawing tests and vendor-observed behavior.
4. No regression in existing functionality or uncontrolled growth in memory; tests, exact commands, runtime and limitations recorded.
5. Lead signs off only on demonstrated evidence. Proposed accuracy or speed targets in other plans are targets, never claims.

## Shared benchmark fixture contract
Store **metadata and manifests only** in Git: fixture ID, origin/permission, sanitized description, vector/raster status, page count, scale, sheet/version, trade, ground-truth policy, expected symbols by class/page/zone, known ambiguities, reviewer and date. Customer PDFs stay in approved local/private storage, not GitHub or third-party services without consent. Use generated non-sensitive fixtures in repository tests. Do not publish screenshots with customer identifiers.

## Failure register
For every failed case capture fixture ID, expected vs actual, failure category (parse/selection/candidate/match/duplicate/revision/zone/export/performance), reproduction, suspected cause, fix link, regression test and re-test status. Prioritize recurring high-impact misses over speculative optimizations.

## Agent ownership and coordination
Lead Codex is the sole orchestrator and final integrator. **vector_engineer** owns scoped recognition changes. **qa_benchmark** independently evaluates. **data_integrity** reviews state and security. **performance_reliability** profiles. **fire_workflow** reviews all six MEP trades. **competitive_analyst** researches evidence-backed competitor differences. **apple_designer** proposes accessible UI changes. **estimating_excel** verifies exports, deferred. Keep max four concurrent specialist threads; start with vector + QA, use third for data integrity or competitive research as capacity allows. One writer per file; review diffs and tests before merge. Agent instructions saying read-only are behavioral, not OS-level enforcement; use protected branches/permissions/worktrees as appropriate.

## Competitive intelligence operating standard
Study Countfire, Groundplan, Ensign, Procore, STACK, Trimble, Bluebeam Revu, PlanSwift and Autodesk Takeoff using current public product docs and permitted normal UI observations. Record dated source, product edition, vendor claim vs independently observed behavior, unknowns, workflow steps, estimator time and correction effort. Rank opportunities by customer impact, evidence, implementation risk and dependency. Do not copy proprietary code/assets or circumvent access controls.

## Sources and versioning
Prefer current official Codex configuration docs: https://learn.chatgpt.com/docs/agent-configuration/subagents and https://learn.chatgpt.com/docs/config-file/config-reference . Custom .codex/agents/*.toml files require name, description and developer_instructions. Confirm the installed Codex version supports the project configuration; configuration committed to GitHub does **not** demonstrate agents are running. Primary references: PDF.js https://mozilla.github.io/pdf.js/ ; ISO PDF standard catalogue https://www.iso.org/standard/75839.html ; Playwright https://playwright.dev/docs/intro ; OWASP File Upload Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html ; NCC https://ncc.abcb.gov.au/ ; Apple HIG https://developer.apple.com/design/human-interface-guidelines/ . Verify editions and applicable licenses.

## Local startup and verification checklist
1. On Mac, inspect `git status`, active branch and unpushed changes; **do not blindly reset, overwrite or force-pull**. Integrate remote commits safely.
2. Parse `.codex/config.toml` and every `.codex/agents/*.toml` with a TOML parser; assert each has name/description/developer_instructions and role paths exist.
3. Check installed Codex version and multi-agent capability. Start new Codex session in trusted repo and spawn one read-only QA task to confirm loading; do not assume GitHub commits launch agents.
4. Verify REA is connected locally before assigning it. Map current repository state, run existing tests, record baseline.
5. Delegate one narrow vector task and an independent QA benchmark; return measured evidence, not planning-only prose.

## Weekly decision report
What was implemented; source commit; which authorised fixtures were used; baseline vs new accuracy, corrections, runtime, memory and export reconciliation; regression results; unresolved failures; top three next executable actions. Report unknowns explicitly.
