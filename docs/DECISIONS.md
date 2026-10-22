# Decision record

## ADR-0001 — Private original implementation (accepted 2026-10-22)

Build Fire Take Off as a private functional equivalent using original code and authorised material. Keep full public takeoff/estimating parity as the objective. Do not extract Countfire source or reuse restricted assets. Consequence: public behavior research and our own acceptance fixtures drive implementation.

## ADR-0002 — Foundation gate and durable memory (accepted 2026-10-22)

Use root AGENTS.md and linked version-controlled documents as persistent memory. CURRENT_STATE is the recovery entry point; update after every meaningful session. No product build until Phase 0 mandatory checks pass. Consequence: successful documentation delivery alone cannot close Phase 0 if live REA access is unresolved.

## ADR-0003 — Defer product stack adoption (accepted 2026-10-22)

ARCHITECTURE is a recommendation with alternatives. Select dependencies and packaging only after measured PDF/recognition/geometry work and documented requirements. Empty apps/packages directories are intentional.

## ADR-0004 — Separate verification levels (accepted 2026-10-22)

Distinguish host prerequisites, REA installation, registration/instructions health, CLI analysis and live-session MCP analysis. Product features remain NOT STARTED. No status promotion from setup output or documentation alone.

## ADR-0005 — GitHub connector fallback (accepted 2026-10-22)

The connected GitHub account has admin/push permission on the private empty repository; shell Git cannot resolve github.com and gh is missing. Publish verified text files through GitHub Git-data/contents APIs with head checks, and reconcile local Git history by reproducing the authenticated remote commit/tree objects and verifying their hashes. Record this as API publication rather than a successful shell git push. Never replace unknown remote work.

## ADR-0006 — Authenticated UI evidence and takeoff boundaries (accepted 2026-10-22)

Chrome DevTools MCP now connects to the user's authenticated beta Countfire tab. Research uses normal visible workflows and stores only sanitised descriptions, not source, account data, project identifiers, private rates or third-party drawing assets. Observations are evidence of controls/navigation, not successful Countfire operation or Fire Take Off acceptance. Keep takeoffs as separate entities under a project, with estimates and specification comparisons also separate. Add title extraction and product catalogue requirements discovered in the UI. REA remains unverified; no product build starts unless the original gate passes or the user explicitly waives it.

## ADR-0007 — Independent research PDF oracle (accepted 2026-10-22)

Use installed Apple PDFKit/AppKit through small Swift research scripts to independently render and inspect original fixture PDFs. The future product renderer remains undecided. Repeated 10/100-page sets test page indexing only; they do not represent complex construction sheets or establish performance budgets. Keep generated assets ignored and record actual digests. Preserve source-specific documented rules separately from executed reference behavior; browser upload denial cannot be treated as import success or bypassed.
