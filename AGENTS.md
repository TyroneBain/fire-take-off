# Fire Take Off — development instructions

## Product objective
Build an independently implemented fire-protection takeoff and estimating product with symbol-counting performance and practical workflows competitive with Countfire. The central requirement is accurate, fast, reviewable symbol recognition and colour-coded counts, not a visually identical competitor product.

## Non-negotiable counting behaviour
- Import and render construction PDFs without altering original documents.
- Let users select one or more examples of a symbol, search the chosen page/drawing/discipline scope, and highlight detected instances in a user-selected colour.
- Maintain clear per-symbol and per-heading quantities, with persistent colour assignments.
- Allow users to accept/reject matches, add missed instances, reclassify, correct selections, and rerun counts without silently losing manual corrections.
- Preserve traceability from totals to individual marks and exported quantities.
- Handle real-world vector and raster PDFs, rotated/scaled symbols and visually similar nonmatches as explicit engineering targets. Measure precision, recall, latency and regression results on owned/licensed ground-truth fixtures. Do not claim parity or superiority without comparative evidence.
- Retain existing working functionality and tests. Improve recognition algorithms when benchmarks demonstrate gains; do not invent unrelated workflows or replace established counting interactions merely to be different.


## Immediate priority — vector-element symbol recognition (2026-10-30)
The owner's explicit requirement is the practical Countfire-style counting capability: select a symbol (e.g. SSVG), choose the specific constituent lines/shapes that define it while excluding intersecting pipework or other unwanted geometry, automatically find equivalent symbols, mark each match in a persistent user-selected colour, and reconcile the quantity. This is a **functional** benchmark, not permission to copy competitor implementation or distinctive UI.

**Stop expanding unrelated features and do not spend this milestone polishing the interface.** Before replacing the existing matcher, audit `apps/local/web/matcher.mjs`, PDF.js rendering/operator access, selection-cleaning UI, existing worker/scoping, saved corrections and tests. The current `binary-overlap-1` raster matcher is a useful baseline but does not establish element-level recognition or real-drawing accuracy.

Implement a staged, independently designed proof of concept:
1. On original or licensed vector PDFs, extract usable path/stroke/curve/transform information from PDF drawing operations; investigate whether grouping and identity survive CAD exports. Document limitations of PDF.js operator lists and nested forms/clipping rather than assuming vector objects correspond neatly to whole symbols.
2. Build interactive selection of constituent geometric elements with inclusion/exclusion, including ignoring pipework crossing a selected sprinkler symbol. Preserve source coordinates and existing example identity; never silently discard manual edits.
3. Match normalised arrangements across pages/drawings using efficient spatial candidate search and explicit tolerances; support translation and 90-degree rotations first, then measured scale tolerance where needed. Distinguish near-lookalikes and overlapping strokes. Retain the raster matcher as a fallback for image-only/flattened PDFs.
4. Connect detections to existing colour overlays, count items, review/correction, persistence and Excel export without rewriting working subsystems. Keep cancellation atomic and existing review decisions intact on reruns.
5. Create independently labelled vector and raster fixtures with identical symbols, distractors, intersecting pipework, rotated/scaled examples, nested form objects and realistic page sizes. Measure precision, recall, false positives, missed matches, time and memory. Do not claim parity or superiority until representative authorised real-drawing benchmarks support it.

**Execution gate:** First record a concise technical feasibility assessment and incremental plan in project documentation, then build the smallest end-to-end vector-element selection/matching demonstration and run regression tests. If vector extraction cannot reliably recover selectable elements for some PDFs, report the evidence and choose a hybrid approach rather than forcing a brittle design. Do not overwrite or reset Codex's concurrent unpushed changes; coordinate before editing application code.

## Independent implementation and IP boundaries
- Countfire may be used as a competitive functional benchmark through public documentation and normal authorised use, subject to applicable terms.
- Do not copy or closely reproduce Countfire's source code, assets, icons, text, branding, distinctive screen layouts, or trade dress. Do not extract proprietary data or bypass access controls.
- Build an original, efficient UI using docs/design/APPLE_DESIGN_RULES.md for general usability principles, not Apple's proprietary assets. Similar generic controls and functional steps may be necessary; do not deliberately recreate distinctive visual expression.
- Do not assume independent code eliminates patent, contract, design or trade-mark risk. Flag uncertain rights issues for professional review before commercial launch.
- Use original or properly licensed test fixtures and dependencies; record licence provenance.
- Never describe the product as a Countfire clone in new product-facing copy.

## Engineering workflow
1. Inspect the existing repository, docs/CURRENT_STATE.md, docs/ROADMAP.md and docs/FEATURE_PARITY.md before edits.
2. Focus on the user's requested feature. Do not redesign, rebuild or expand scope without approval.
3. Implement changes in small, testable increments, keeping data formats and saved work compatible.
4. Add automated tests for count accuracy, colour mapping, manual corrections, persistence and export reconciliation.
5. Document measured outcomes, limitations, tests and next steps accurately. Do not claim tests ran unless observed.
6. Keep the repository private; do not commit credentials or customer drawings. Do not force-push or discard unrelated changes.
7. The catalogue remains deferred until the user requests it.

## Historical records
Earlier project documents contain requests for a visual Countfire clone. Those instructions are superseded by this independent-product objective. Preserve historical evidence and user decision records as history, not as current implementation instructions.

## Standing product decisions — owner confirmation, 2026-10-30
- Fire Take Off is a legitimate independent competitor in the construction takeoff market. Aim to equal Countfire's practical symbol selection, element inclusion/exclusion, automatic recognition, review and colour-coded counting capabilities, and ultimately improve on accuracy and usability.
- **Functional parity does not mean copying implementation.** All application code, recognition algorithms, architecture, UI expression, graphics and assets must be original or appropriately licensed. Do not access, reverse engineer or copy Countfire proprietary code or assets; do not use its service in breach of contractual restrictions to develop a competitor. Publicly documented functional behaviour can inform requirements.
- The immediate engineering priority remains the counting/recognition engine and realistic accuracy benchmarks; avoid unrelated feature work or UI polish until this works reliably.
- Existing takeoff products offering similar features do not by themselves establish freedom to operate. Track patent, copyright, design, trademark, licensing and contractual questions for review before commercial release. Do not claim legal clearance, but do not confuse unverified risks with a finding of infringement.
- Preserve current working functionality and project history. Use small testable milestones and report demonstrated results, not assumed Countfire parity.

## Competitive AI roadmap — 2026-10-30
Read `docs/COMPETITIVE_AI_ROADMAP_2026-10.md` before planning new features. Countfire's publicly announced Smart Select and forthcoming legend takeoff are competitive benchmarks, not implementation specifications. Finish measured P0 counting accuracy before starting AI features. Maintain original implementation and human-reviewed quantities.

## Competitive execution plan — mandatory gate (2026-10-30)
Read `docs/COUNTING_COMPETITIVE_EXECUTION_PLAN_2026-10.md` at the beginning of each Codex session. Treat it as the controlling gate-based plan for counting competitiveness: baseline audit, vector feasibility, end-to-end recognition, real-drawing Countfire benchmark and go/no-go decision. Its proposed performance thresholds are targets, not achieved results. Do not divert into AI, cosmetic redesign or peripheral features before the core counting benchmark unless the owner explicitly changes priorities. Maintain evidence and preserve local/unpushed work.
