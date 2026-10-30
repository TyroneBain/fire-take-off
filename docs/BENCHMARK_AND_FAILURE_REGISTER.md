# Recognition benchmark register — template and protocol
2026-10-30. No real-world benchmark is implied by this template.

### 2026-10-31 shared original-paint verification checkpoint

- Browser backend mismatch: original display-canvas oracle failed 0/8; explicit readback contract and shared original-PDF adapter independently yield 7/8 visibility proofs, repeated exactly in Chrome. The text-overlaid candidate remains refused. These are pixel-presence checks, not accepted counts or source/target class equivalence.
- Actual application recognition remains 21 TP / 0 FP / 8 FN over 29 development labels. Fresh projects remain admission-blocked (unsupported clipping; excessive selection elements), with no fresh accuracy claim.
- Optional-content support uses actual PDF.js group visibility, validates known groups, bounds membership expressions and invalidates changed configurations. Hidden clipped paint cannot use clip fallback.
- Regression: 287/287, zero failures. Original layered, translucent, white-overpaint, stale-handle and cancellation controls pass. Production state/116 marks and eight protected module hashes unchanged.
- Next bounded blocker: generic complete-footprint rectangle-clip proof; preserve unknown/nonrectangular/partial clipping fallback. No speculative threshold relaxation. Original render timeout exists; operator-list preparation cancellation still waits for extraction to settle.

### 2026-10-31 constituent proposal gate

Original independently labelled PDF: whole-operation baseline 4/13 versus constituent proposals 10/13, zero main-class false positives. Both actual Chrome passes agree. Separate physical cap/join negative is proposed despite 64 missing black pixels; automatic acceptance blocked. Quantized close-segment self-match failure was fixed with nearest-error assignment and independent original regression; default tolerance unchanged. Real development bridge remains 1/29; 26/29 fills have different tessellation lengths, grid quantization and overlapping closed walks. A private contour diagnostic reaches only 3/29 unverified proposals. No real-app accuracy gain or release approval. Reproduce with `scripts/benchmark-vector-constituents.mjs`, `tests/vector-constituents*.test.mjs`; detailed private evidence is `integration-constituent-*`, `engine-constituent-contour-probe.json`, and `qa-constituent-browser-results.json` under `.local/real-benchmark/`. Preserve all previous drawing labels and failures.

## Fixture manifest (one record per authorized drawing set)
Fixture ID | permission/owner confirmation | private storage location (never customer data in Git) | vector/raster/mixed | trade | sheet/page IDs | symbol types | ground-truth reviewer/date | expected counts by page/type/zone | ambiguities | benchmark version.

## Per-run results
Commit SHA | runtime/device | fixture ID | baseline/candidate | TP | FP | FN | precision TP/(TP+FP) | recall TP/(TP+FN) | duplicates | correction actions | estimator minutes | p50/p95 match latency | peak memory | export reconciles Y/N | reopen corrections survive Y/N | notes.

Record undefined precision/recall when denominators are zero. Keep ground-truth labels independent of algorithm output. Use matched symbol instances, not just equal aggregate totals. Mark results from generated synthetic fixtures separately from owner-authorized real construction PDFs.

## Failure register
ID | fixture/page | expected vs observed | category (PDF parse, symbol selection, matching, false positive, missed symbol, duplicate, zone, persistence, revision, export, performance, UI) | reproducible steps | severity | assigned agent | code/test link | status | retest evidence.

## Exit gate
A counting claim requires independently reviewed real-drawing evidence, preserved corrections after reopen, exact reconciled exports, performance profile, and documented limits. Proposed numeric accuracy targets are aspirational until measured. Do not commit customer drawings or identifying metadata.

## Observed failures — authorised A1 pair, 2026-10-30

| ID | Category | Observed result | Status / next action |
|---|---|---|---|
| A1-001 | Render capacity | 16.06Mpixel fullpage rejected by4Mlimit | Fixed2x boundedtiles implemented;178tests and17A1browserchecks pass |
| A1-002 | Recognition | Chrome4TP/0FP/15FN across19 provisional visually labelled symbols | Open;21.05%recall insufficient; preserve detail and investigate raster phase/background |
| A1-003 | Environment | Node5detections vsChrome4 on identicalsourcepair/seed | Open; cause not established; report separate metrics |
| A1-004 | Memory | Controlled fresh-process Node three-search peak 2.64 GB → 578 MB with identical results after inter-tile timer yield | Fixed for this measured Node case; browser/native memory and long-duration behavior remain unverified |
| A1-005 | False positives | 1pixel-distance prototype accepts shifted internal dot | Experiment rejected, no production matching changes |
| A1-006 | Workflow | Largepage elementeditor andglyphmask retain separate4Mlimits | Open; outlinefallback, no claim of full largepage vector workflow |

Source PDFs/private labels/workbooks remain ignored .local. Public-facing/private-repo evidence is anonymised in docs/evidence/real-drawing-capacity-2026-10-30.json. Counts are geometry-family labels, not estimator-confirmed product quantities.

### Appearance preview follow-up

- The rejected independent-pixel drift experiment remains excluded. The new original matcher uses a global subpixel fit, retained colour and symmetric internal-detail checks. Independent controls: 14 TP, 0 FP, 1 FN over 15 positives and 16 negatives; black diagonal occlusion remains a miss.
- First unseen Node v3 run: 7/10 versus strict 3/10, with one lost baseline hit. An orientation-selection defect was then identified and fixed using unchanged acceptance gates plus an original counterexample. This third sheet is regression data for v4, not fresh held-out validation.
- Frozen v4 module in Chrome: two identical passes; first pair 13 TP / 0 FP / 6 FN versus strict 4 / 0 / 15; third sheet 8 / 0 / 2 versus 3 / 0 / 7. All shared strict anchors exact; no duplicate or outside-region hits. Application workflow acceptance is recorded separately in the latest evidence.
- Existing correction dedup uses strict per-axis <0.5 PDF point. An isolated probe showed a shifted new hit could bypass an exclusion. Appearance saves now conservatively reject ambiguous new hits near protected corrections before any mutation; global dedup is unchanged. Dense genuine neighbours can trigger a conflict and require review.
- Owned 12-symbol PDF acceptance covers declared quarter-turn placements. Its fractional-phase and oblique-angle challenges remain outside that main oracle; 12/12 is not general accuracy. Private real labels remain provisional AI visual review, with legend/workbook corroboration rather than human estimator certification.


### Broader sources and A1 selection follow-up, 2026-10-31

| ID | Category | Observed result | Status / next action |
|---|---|---|---|
| A1-006a | Element editing | Bounded large-page metadata/crops now support renderer-applied nonpainting clips; owned UI13checks and independent exact-PDF tests pass | Fixed for supported A1 cases; compositing/forms/combined clip-and-paint fail closed; legacy small-page hidden-path limitation remains |
| A1-007 | Preview | Static omission masks concealed newly revealed underlying paint | Fixed using serial latest-only actual filteredPDF preview; independent4tests pass |
| MULTI-001 | Generalisation | Fresh2projects: strict2TP/0FP/38FN on40provisional independently labelled symbols | Open;5%recall inadequate; appearance rejects bothsourceexamples before fullscan |
| A1-008 | Recognition experiments | Known-position4x17/29 andsupport-mask18/29 vsunchanged2x21/29 | Rejected for production; oracle-centred diagnostics are not full-searchaccuracy |
| A1-009 | Clip candidates |29/29isolatedfills reconstructexactly onlywhen originalclip+paint transformsretained | Candidate helper testedbutunwired; no acceptedcount gain |

Evidence: `docs/evidence/large-element-selection-2026-10-31.json`. All customer sources, labels and identifying workflow observations remainignoredlocal. Proposed next native-contour work is not implemented capability.
