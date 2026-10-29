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
