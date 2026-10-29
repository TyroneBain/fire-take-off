# Competitive AI roadmap — 30 October 2026

## Evidence and scope
Countfire's public homepage and September 2026 what's-new page describe Smart Select (AI names and organises count selections), automatic bends/tees/reducers, live zones, pricing assistance and specification comparisons. They describe automatic legend takeoff and whole-project discipline sorting as *coming soon*, not shipped. Sources: https://www.countfire.com/ ; https://www.countfire.com/whats-new ; https://www.euw1.aws.countfire.com/blog/guide-to-new-countfire . Do not assume its proprietary internal algorithms or training approach are known.

## Product principle
Build an original fire-protection-focused competitor. Match independently observed functional outcomes, not Countfire code, distinctive visual design, text, assets or private data. Avoid breaching third-party terms. Patent and freedom-to-operate review remains outstanding. Do not claim legal clearance.

## Sequenced plan
P0 — Finish and benchmark counting first. Preserve current selection cleanup, colours, review, corrections, zones, persistence and Excel. Validate vector-element recognition plus raster fallback on owned/licensed real-world sprinkler, hydrant and extinguisher drawings. Measure precision, recall, false positives, missed symbols, latency and memory; include rotated symbols, pipe crossings, lookalikes, multiple scales and revisions. Do not claim parity without evidence.

P1 — Smart item suggestions. From a user-selected symbol and nearby drawing context/legend, suggest an item name, type and category. Show confidence and evidence, allow one-click correction, and never let AI change verified quantities or prices without review. Start with deterministic legend/OCR/rules and optional AI for ambiguous classification; compare cost and accuracy before adding model calls. Keep customer drawings private and use explicit consent for any external AI processing.

P1 — Legend-driven takeoff. Extract legend candidates, let estimator approve mappings, then search across the discipline and reconcile all detections to individual marks. Reject ambiguous legend symbols rather than silently counting them.

P2 — Drawing classification. Suggest discipline, floor, revision and sheet name from PDF title blocks and filenames, with review. Support batch upload and duplicates/revisions.

P2 — Fire-services length intelligence. Identify and review pipe lengths, bends, tees, reducers, drops and risers with scale and snap validation. No automatic pricing from unverified geometry.

P3 — Estimating assistance. User-controlled item catalogues, assemblies, labour/material rates, supplier-price provenance, margins, revision impact and Excel outputs. Keep AI suggestions separate from approved commercial values.

P3 — Specification and revision comparison. Flag textual requirements and changed quantities with linked source locations and human approval.

## Execution rules for Codex
1. Read AGENTS.md and this roadmap at the start of a new development session.
2. Work only on P0 until measured acceptance criteria are agreed and passed; no broad AI implementation tangent.
3. Audit current capabilities before changing code, reuse working modules, protect uncommitted local work and create small tested milestones.
4. Maintain a competitor capability ledger with source URL, observed date, announced versus released status, our status, evidence and next action. Review periodically, not via unsupported assumptions.
5. AI is assistive, auditable and optional. Never use AI-generated guesses as verified takeoff quantities.
6. Do not silently send customer PDFs or data to external model providers. Document costs, privacy, latency, fallback and data retention before any AI integration.
