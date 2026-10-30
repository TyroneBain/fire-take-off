# Recognition benchmark register — template and protocol
2026-10-30. No real-world benchmark is implied by this template.

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
| A1-004 | Memory | Node3run processpeak1.88GB→1.77GB aftercanvascleanup | Open; controlled browser/cache profiling needed |
| A1-005 | False positives | 1pixel-distance prototype accepts shifted internal dot | Experiment rejected, no production matching changes |
| A1-006 | Workflow | Largepage elementeditor andglyphmask retain separate4Mlimits | Open; outlinefallback, no claim of full largepage vector workflow |

Source PDFs/private labels/workbooks remain ignored .local. Public-facing/private-repo evidence is anonymised in docs/evidence/real-drawing-capacity-2026-10-30.json. Counts are geometry-family labels, not estimator-confirmed product quantities.
