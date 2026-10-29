# Competitive product execution plan — 30 October 2026

**Status:** owner-directed plan; targets are proposed acceptance criteria, NOT achieved results. **Mission:** build an independently engineered, fire-protection-first takeoff product that can win paying customers against Countfire through trustworthy counting, fast corrections, a simpler workflow and competitive value. **Current verdict:** technically plausible, commercially unproven; no parity claims.

## Verified competitor research and limits
- Countfire product workflow: select a symbol, detect matching instances across drawings, review/correct marks, measure lengths, export by drawing/zone/type. https://www.countfire.com/product/takeoff-software
- Countfire selection guidance: too-complex selections miss instances; too-simple selections produce false positives. Hide background/already-counted marks; edit the symbol and retain only defining vector elements. https://www.countfire.com/blog/how-to-use-takeoff-software/
- Countfire Selections 2.0: automatic handling of rotations and floating references; editable floating reference elements. https://feedback.countfire.com/changelog/selections-20
- Countfire Smart Select names/organises selections using AI; its website describes automatic legend takeoff and whole-project sorting as **coming soon**, not shipped. https://www.countfire.com/whats-new and https://www.euw1.aws.countfire.com/blog/guide-to-new-countfire
- Countfire claims speed/accuracy; do not treat marketing claims as independently measured benchmarks. We do NOT know its algorithm or our parity. Owner uses Countfire at work and reports good-quality vector PDFs count very well, with extra detections easily erased. Groundplan is an owner-reported alternative; do not infer market share or quality rankings.
- Research is public/authorised product observation only. Do not access competitor code, proprietary data, restricted APIs, or use competitor service in breach of terms.

## Product definition: minimum competitive fire-protection workflow
1. Import a full discipline of licensed/original fire drawings, preserve original PDFs, reliably display each sheet and maintain coordinate mapping through zoom, pan, rotation and revisions.
2. Click/box a symbol example, inspect its constituent PDF vector paths, add/remove paths to form a clean signature, and ignore crossing pipework, labels and background detail. If the PDF doesn't expose usable paths, clearly fall back to raster or manual mode.
3. Find equivalent sprinkler, hydrant, hose reel, extinguisher and other fire symbols across **the selected discipline**; support translations, right-angle and arbitrary rotations when evidence requires, realistic scale variation, floating annotations/references and distractors. Never assume all PDFs retain object identity.
4. Show every result as a coloured, individually auditable mark. Accept, erase false positives, add misses, reclassify and edit a signature without losing deliberate human corrections; preserve explicit user decisions across reruns.
5. Display per-item, per-sheet, per-zone and discipline totals with duplicate/overlap rules, correction history, confidence/review status and traceability. Excel exports must reconcile exactly to the visible reviewed instance ledger.
6. Deliver a clean, fast estimator workflow with discoverable shortcuts, undo/redo, clear loading/progress/cancel, and robust saving. Keep visual expression original.

## Hard priority order / anti-scope-creep
**Gate 0: baseline audit (documentation only, first).** Read AGENTS.md, README, docs/CURRENT_STATE.md, docs/ROADMAP.md, docs/FEATURE_PARITY.md, docs/COMPETITIVE_AI_ROADMAP_2026-10.md, existing matcher and tests. Build a verified current-vs-target matrix (working / partial / absent / untested) and identify actual bottleneck. Existing README reports a binary raster matcher, partial vector selection cleanup, same-size/orientation matching, and limited 20-page search. Do not erase functioning capabilities or assert a feature is absent without inspecting it.

**Gate 1: vector feasibility spike.** On authorised vector drawings, inspect PDF operator/path extraction, graphics-state transforms, clipping, nested form XObjects, strokes, line widths, text, page rotation and CAD export variation. Prototype hit-testing and selecting/removing constituent paths from a sprinkler signature. Test crossing pipework and near-identical symbols. Produce an evidence-backed decision: vector-first, hybrid or fallback; document unsupported formats. Stop and escalate if a reliable selection representation is not viable.

**Gate 2: counting engine end-to-end.** Implement spatial indexing/candidate generation; geometry normalisation and translation/rotation tolerance; shape/topology checks; false-positive rejection; stable IDs; discipline-wide matching; progressive UI and bounded memory; deterministic repeatability. Retain raster fallback, and avoid expensive exhaustive pairwise matching. Wire into existing colours, zones, persistence, user corrections and Excel. Use small incremental PRs/commits; never replace working subsystems speculatively.

**Gate 3: measured competitive benchmark.** Owner supplies **five or more authorised representative drawing sets** (simple clean vector, dense vector with crossing pipework, rotated/floating-reference symbols, multi-sheet/zone set, poor/flattened raster). No customer PDFs or Countfire outputs in public repos, external AI or CI; obtain permission before using workplace/client material. Create ground truth by independent human verification; record item-by-item truth, duplicate rules and ambiguous cases. Owner performs authorised side-by-side Countfire tasks on the same inputs where permitted. Measure:
- precision = correct detections / all detections; recall = correct detections / all true instances; separate metrics by drawing, symbol and input type;
- false positives, misses, duplicate counts, review/correction clicks, elapsed estimator time (import → reviewed Excel), matching latency, peak memory, crash/recovery, export reconciliation;
- user-visible correction reliability and persistence after restart/recount.
**Proposed stretch threshold (not evidence):** ≥98% precision AND ≥98% recall on the clean-vector subset, zero unreconciled export discrepancies, zero lost reviewed corrections; user task completion within ~1.25× Countfire on same task after familiarisation. Do not average away a failed drawing or silently exclude hard examples. Agree minimum commercially acceptable performance with owner after baseline measurement. If targets fail, do not declare success; identify blockers and cost to fix.

**Gate 4: limited field pilot / commercial validation.** Invite 3–5 consenting fire estimators/contractors to trial authorised drawings. Record task success, willingness to pay, switching barriers, support burden and feature requests. Before substantial expansion, secure evidence that at least a few prospective buyers would pay at an economically viable price. Validate hosting/security/data retention, licensing, support and relevant IP/contract advice before commercial release.

**Gate 5: differentiated improvements, only after Gate 3.** In order: easier/faster correction UX; robust drawing revisions; fire pipe lengths, snapping and fittings; legend-assisted takeoff; optional AI name/category suggestions; drawing sorting; estimate/price workflows; spec comparison. Use the existing AI roadmap for sequencing, human approval and privacy. Do not chase every Countfire feature.

## Technical acceptance scenarios (automate where possible)
A. Select sprinkler vector strokes; erase intersecting pipe segment; identical instances still match across multiple sheets.
B. Similar-but-not-identical heads and annotations are not silently counted; show uncertain candidates for review.
C. Match rotated and shifted reference elements; verify 90° and 180° first, then arbitrary angles with measured evidence.
D. Rerun after changing a selection; manual additions, explicit exclusions, reclassifications and multipliers persist by stable identity; ambiguous conflicts surface for review, never silently overwrite.
E. Two overlapping zones and an outside-outline symbol reconcile; zone edits refresh on-screen totals and Excel.
F. Import revised sheet; show additions/removals, preserve prior snapshot/audit and avoid cross-revision double counts.
G. Raster-only, clipped, malformed and large PDFs degrade gracefully with an explicit fallback and limits.
H. Exported per-item/sheet/zone totals equal reviewed marks and include correction traceability; verify on reopen.
I. Cancel, browser refresh, import failure, and process restart leave consistent state; no half-committed counts.
J. No customer data leaves local environment without opt-in; no credentials/drawings committed.

## Execution rhythm and decision checkpoints
- **Week 1:** baseline matrix, fixture permissions, reproducible Countfire test protocol, vector extraction spike, first measurable demo.
- **Week 2:** element editor + same-sheet geometric matching, distractor tests, metrics.
- **Week 3:** multi-sheet discipline counting + corrections/persistence + performance.
- **Week 4:** end-to-end benchmark, Excel reconciliation, owner go/no-go review.
These are **planning timeboxes, not promises**; report slippage and evidence. Codex should not claim that merely generating code or passing synthetic tests meets a gate.

**Decision at day 30:** GO only if an end-to-end demo on real permitted vector drawings is credible, core metrics are close to the agreed target, corrections/exports reconcile, and remaining work has a realistic effort estimate. CONDITIONAL GO for a clearly bounded gap with owner-approved time/cost. NO-GO or pivot to a narrower fire estimating niche if extraction/matching remains unreliable or projected effort is uneconomic. Escalate blockers early; never bury a failed benchmark under new features.

## Required artifacts for each gate
1. `docs/COMPETITOR_CAPABILITY_LEDGER.md`: source, observation date, released/announced, confidence, our verified status, evidence.
2. `docs/VECTOR_FEASIBILITY.md`: tested PDF types, operator limitations, extraction approach, performance, fallback and unresolved risks.
3. `docs/BENCHMARK_PROTOCOL.md`: ground truth instructions, drawing permissions, tasks, environment, metrics, test runs and reproducible results (no sensitive drawings).
4. `docs/GO_NO_GO.md`: current evidence, open blockers, estimated effort/cost, recommendation and owner decision.
Update these as work progresses, not with invented results.

## Codex operating contract
- At every session start, read this plan and AGENTS.md; report current gate, last verified evidence, next smallest testable step.
- Prioritise Gate 0 → 3; do not work on AI, cosmetic redesign, catalogue or tangential features without explicit owner approval.
- Keep existing tests green, add regression tests, and distinguish unit/synthetic evidence from manual browser tests and representative real drawings.
- Work in small reversible changes, preserve local/unpushed work and schema compatibility; do not force-push or overwrite concurrent edits.
- Never fabricate competitor capabilities, benchmarks, tests, customer feedback, or claims of parity.
- Report a short status: implemented, verified, failures, risks, next action, and whether the current gate passed.
