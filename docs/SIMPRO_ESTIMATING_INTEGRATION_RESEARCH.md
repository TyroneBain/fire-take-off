# Estimating scope breakdown and simPRO integration — research brief
2026-10-30. Requested product direction, not a verified simPRO API implementation.

## Customer outcome
Let an estimator count across a drawing set and choose whether to price one overall quote or separate prices by page, zone, floor, building, discipline, system or user-defined scope. Produce a combined total plus optional per-scope subtotals. Transfer reviewed scopes to matching simPRO quote/job cost centres if the customer's supported simPRO environment permits it.

## Research questions (do not guess)
1. What simPRO product/edition, licensing, API access, OAuth/auth method, permissions and cost centre structures are available to the user? Review official simPRO developer documentation and import/export help, confirming exact object semantics and supported endpoints before design.
2. Can a quote be created/updated with cost centres, sections, line items, materials, labour, markup and tax through supported APIs? If not, what supported CSV/XLSX or guided import workflows exist? What is quote vs job behavior?
3. How should our takeoff map source PDF -> page -> trade -> zone -> scope/package -> item -> unit quantity -> price -> quote section -> simPRO cost centre? What about overlapping zones, repeated sheets, shared items, exclusions, revisions and unallocated quantities?
4. How to avoid double posting or unintended edits? Require idempotency keys/own mapping IDs, review preview, change diff, rollback/reconciliation strategy and explicit user confirmation for writes.
5. Which integration is cheapest and simplest for small contractors versus larger estimators? Compare: (A) robust standalone Excel with scope subtotals; (B) simPRO-friendly structured import; (C) supported API integration, only if verified and authorized.

## Required proposal and proof
- Show a worked fictional example: sprinkler count across three pages and two zones; separate prices and combined total; no duplicated quantities; an unallocated bucket if needed.
- Document editable package rules (page, zone, custom), split/allocation precedence, units, per-line rate provenance, labour/material, tax and rounding policy.
- Produce mapping table of Fire Take Off fields to verified simPRO concepts, with citations and unknowns.
- Include acceptance tests: sum of package quantities equals reviewed takeoff quantity by item; package subtotals reconcile to overall quote; Excel formulas and imported cost centres reconcile; changed zone boundaries update allocations; revision diff cannot silently duplicate simPRO line items.
- Deliver a short recommendation, staged implementation sequence and dependencies. No credentials, real customer plans or quote writes in tests.

## Initial product recommendation to validate
Start with a trade-neutral **quote breakdown layer** and a clean Excel export showing per-page/per-zone/custom scope prices and rollups. Add a reviewed simPRO mapping/export adapter once official capabilities are confirmed; direct API synchronization comes last. Keep recognition, saved corrections and original exports unchanged.
