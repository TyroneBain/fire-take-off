# Public reference rules — 2026-10-22

Read through normal Chrome pages in the public help centre. These are documented reference requirements, not live behavior tests or Fire Take Off acceptance results. Article dates below are those displayed by the source. Third-party images, animations and output templates were not copied. Beta behavior may differ.

| Source | Parity | Documented rule | Remaining question |
| --- | --- | --- | --- |
| [Zones](https://help.countfire.com/en/articles/90849-zones), 2026-08-27 | F021,F034,F063 | With no zones, output includes the whole drawing. With zones, only included regions contribute. Zone names belong to a discipline; polygons belong to drawings. Deleting a name also deletes its polygons. | Exact point-on-edge rule; non-itemised lengths crossing zones |
| [Zone ordering](https://help.countfire.com/en/articles/423830-zone-name-ordering), 2026-08-25 | F063 | Earlier headings receive overlapping quantities first. Reordering changes allocation and its visual presentation. | Equal-name overlapping polygons and boundary ties |
| [Scale](https://help.countfire.com/en/articles/71790-setting-a-scale), 2026-08-20 | F017 | Each drawing needs scale validation. PDF physical page size can differ from the title block; ratio alone is insufficient without checking a known length. | Current imperial input, propagation, numerical precision |
| [False positives](https://help.countfire.com/en/articles/64550-false-positives), 2026-08-28 | F008,F009,F013 | Simple examples and text represented as geometry can cause wrong matches. Additional examples and output review are part of the documented correction workflow. | Measured matching behavior and manual override/recount precedence |
| [Reclassification](https://help.countfire.com/en/articles/9792689-match-reclassification), 2025-06-28 | F062 | Individual matches can move between headings. Sidebar totals and colors update; original classification remains visible. Keyboard review supports next/previous and destination selection. | Undo/recount, revised drawing behavior, persistence boundaries |
| [Workbook](https://help.countfire.com/en/articles/114655-excel-spreadsheet), 2025-06-28 | F034,F035 | Output contains overview, drawing list, notes and discipline worksheets. Automatic and manual quantities are separate sections; drawing/zone columns provide breakdowns. Missing scale is highlighted; saved edits require another export. | Actual cell schema/formulas, rounding, current beta output |
| [Itemisation](https://help.countfire.com/en/articles/64556-itemising-measurements), 2025-06-28 | F064 | Default output aggregates measures. Itemisation exposes each measure plus totals. A cross-zone itemised measure belongs to the zone containing most of it. | Equal split, length versus area dominance and rounding |
| [Checking outputs](https://help.countfire.com/en/articles/354690-reviewing-the-check-sheets), 2025-06-28 | F016,F065 | Review generated match evidence, correct selections/classifications/false positives in the app, save and regenerate until checked. | Actual generated layout and stable links back to source instances |

## Inventory discoveries requiring article follow-up

The [54-article takeoff collection](https://help.countfire.com/en/collections/3250430-completing-takeoffs) also links quantity multipliers, measurement multipliers, zone multipliers, floating references, Ignore classifications and symbols-removed outputs. These become F066–F071 with explicit unknown behavior. Their titles establish research scope; they do not establish detailed rules. The help index is now reachable in Chrome although web search returned no relevant results and direct web retrieval failed.

## Controlled beta observations

An unassigned project named `Fire Take Off synthetic research 2026-10-22`, takeoff `Rev 0`, and empty discipline `Synthetic fixture` were created through normal UI. The project/takeoff/discipline hierarchy and empty export-disabled state were observed after successful creation. This is the first persistent reference research in this project; earlier no-write observations remain historical.

Upload of our original `small-vector.pdf` was attempted using the normal Upload control. Chrome DevTools MCP rejected the local path as outside its configured workspace roots. No file was uploaded and no count, measurement or export ran. Do not work around this access boundary. The scratch project is intentionally retained for later controlled tests; no unrelated project was edited and no assignments/messages were sent. Private URLs and account identifiers remain outside Git.
