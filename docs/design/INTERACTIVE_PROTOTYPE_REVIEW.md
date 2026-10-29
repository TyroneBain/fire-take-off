# Interactive workspace prototype — review checkpoint

2026-10-29. **Prototype only; production implementation is not approved.** This follows the [research proposal](PHASE_1_UI_UX_RESEARCH.md) and Tyrone's provisional approval of A on larger displays, adapting toward B on laptops. The previous source register remains the basis for the design principles; the judgments below are design recommendations and observed prototype behaviour, not new research or estimator test results.

## Open and try it

Open **http://127.0.0.1:4174/** while the local prototype server is running, or open [index.html](../../prototypes/workspace-v1/index.html) directly in a modern browser. Direct file opening was checked in Chrome. To restart the server from the repository root:

```sh
node prototypes/workspace-v1/serve.mjs
```

The prototype is independently implemented in `prototypes/workspace-v1/`. It imports no production modules and has no network API, database or storage access. Its CSP disables network connections. The original Harbour House schematics and all quantities are fictional. Reload or Reset clears changes. Production remains on port 4173.

The study bar offers **Auto / A / B** with the same data and workflows. Viewport presets cap the available area; a small browser cannot display a larger preset at native scale. Use a large enough browser window, or browser device emulation, for exact 1440×900 and 1920×1080 comparisons.

## Refined direction

Use A when simultaneous sheet context and result properties justify two panels. Use B when precision on the drawing benefits more from the additional width. Auto currently changes at **1440 CSS pixels**, with an explicit A/B override. Automatic relocation waits until an active property edit is applied or cancelled. It does not discard the draft. This threshold is a candidate for validation, not a measured optimum.

The header is 48px and the labelled horizontal tool strip is 42px. Project identity, active drawing/revision and project-wide reconciliation stay in the header. Select, Count, Measure, Zone and Note stay in a consistent order beneath it. Contextual commands use spare toolbar space. This keeps frequent actions discoverable while preserving horizontal drawing space better than another permanent tool rail.

A uses a 232px drawing navigator and 320px inspector. B uses one 320px left work panel with **Drawings / Takeoff** navigation; Items, Review and Properties remain secondary inspector tabs. Selecting a sheet returns to takeoff context. Both arrangements have resizable dividers, collapse controls, a drawing-maximise action and a separate Restore layout action. A navigator range is 220–320px; inspector/work panel range is 280–420px. Dividers support arrow keys, Shift+arrows, Home and End.

Drawing quantity scope remains in a narrow strip above the canvas, even when panels are collapsed. Controls occupy the shell, rather than floating over the middle of the paper. At narrow canvas widths the strip wraps instead of clipping quantities. Zoom and scale live in the footer. Manual zoom and the drawing centre survive panel changes; each drawing remembers its view for the current tab session.

The header and tools total 90px, six fewer than the research wireframe's 96px. The prototype also reserves a 32px study bar, a 38px quantity strip and a 28px footer. These costs are explicit; this is not a claim that every vertical dimension improved.

## Measured screen-space comparison

Actual Chrome layout measurements at device scale 1, default panel widths, no browser zoom. Canvas dimensions exclude toolbars, scope strip and footer. They measure available drawing interaction space, not the fitted paper's occupied area or user productivity.

| Viewport | Auto | Canvas in A | Canvas in B | Auto canvas width / viewport |
|---|---|---|---|---|
| 1280×800 | B | 718×612 | **955×612** | 74.6% |
| 1440×900 | A | **878×712** | 1115×712 | 61.0% |
| 1920×1080 | A | **1358×892** | 1595×892 | 70.7% |

B gains 237 horizontal pixels at each size; at 1280 that is 33% more canvas width than A. All nine combinations of viewport and Auto/A/B had no document horizontal overflow, no quantity-summary overflow and a visible review action within the drawing region.

Actual captures: [1280 B](prototype-validation/auto-1280.jpg), [1440 A](prototype-validation/auto-1440.jpg), [1920 A](prototype-validation/auto-1920.jpg).

| Equivalent task | A | B | Design judgment |
|---|---|---|---|
| Switch sheet while inspecting results | Visible sheet list; one sheet click | Drawings tab then sheet; two clicks from Takeoff | A is stronger for frequent sheet hopping. These are control-path counts, not measured user completion times. |
| Select, correct and accept a detection | Canvas → right inspector | Canvas → left work panel | Same controls and numerical behaviour; B gives more drawing area. No measured pointer-travel advantage claimed. |
| Review several results | Persistent right queue and sheet list | Persistent left queue; sheet list replaced | A exposes more project context; B reduces simultaneous information. |
| Inspect overlap priority | Right contextual panel plus drawing | Left contextual panel plus wider drawing | B is preferable when geometry is the primary question; task testing must confirm. |
| Reconcile all drawings | Dedicated reconciliation view | Same view | No layout advantage assumed. Both return to the previous drawing/view. |

**My strongest objection:** at 1440, A leaves only 61% of the width for the drawing. B may prove better for most focused takeoff even there. The explicit override is necessary; do not hard-code this preference into production without trying both. Moving the inspector across sides also changes spatial memory. Deferring relocation during edits helps, but a future preference to lock the layout may be more predictable than continuous auto adaptation.

## Visual and state system

System typography uses the platform's native UI font, tabular quantity numerals, compact 12–14px working text and restrained 15px section titles. Original line icons use a consistent 24-unit construction and 18px rendering. Control corners are 5px; spacing predominantly uses 4/8/12/16px steps. Borders separate regions; elevation is limited to temporary guidance/dialogs and the drawing sheet. Transitions are short and respect reduced motion.

| Role | Prototype token | Purpose |
|---|---|---|
| Shell / panel / raised surface | `#191D23` / `#222831` / `#2C333E` | Stable graphite hierarchy |
| Main / secondary text | `#F2F4F7` / `#B8C0CC` | Readability without making every label equally prominent |
| Primary action | `#E3A34D` with dark text | Restrained warm amber for consequential next actions |
| Geometric selection | `#205BC5` on paper | Precise outline; separate from category colours |
| Shell focus / active tool | `#90B8FF` | Visible focus outline and active-tool underline |
| Categories | Teal circle / purple square in lists | Meaning retained through names, not hue alone |
| Review / exclusion | Diamond + “Unreviewed”; slash + “Excluded” | Review state remains distinct from inclusion |
| Completion / warning / error | Green / warm yellow / coral with text | Explicit messages and recovery actions |

Calculated token contrast: main text/panel 13.46:1; secondary text/panel 8.09:1; dark text/amber 7.74:1; geometric blue/white 6.24:1; focus blue/panel 7.41:1; input border/shell 4.28:1. These pair checks do not establish full WCAG conformance. Keyboard controls, labels, visible focus, reduced motion and non-colour state cues are present. Screen-reader acceptance, high zoom/reflow, forced colours, comprehensive target sizing and prolonged reading comfort remain untested. Compact text needs real estimator feedback.

## Suggested review sequence

1. **Compare layouts.** At 1280×800 try A and B. Drag the divider; collapse and restore panels; maximise the drawing. Switch sheets after zooming, then return. Try the same at 1440×900 and 1920×1080.
2. **Start a count.** Count → Select example → select a symbol → Run demo scan. Cancel once, then complete it. The progress is explicitly simulated; completion reveals seeded review results and preserves corrections.
3. **Correct and review.** Select a diamond-marked head. Change Items per instance from 2 to 3 and Apply: allocated items change 48→51. Undo returns 48. Exclude the original factor-2 result: 48→42. Restore puts it back into review. Reclassify it and inspect the classification totals.
4. **Test failure recovery.** Begin an edit, then Study guide → Fail next change. Apply shows an inline error and retains the draft; retry commits it. Changing drawings while a property edit is dirty is blocked with an explanation.
5. **Find a miss.** Count → Add missing, then click the unmarked symbol in the lower-right corridor. This creates a manual result. Its outside-zone contribution is explained; undo removes it. Note also supports placing, editing and undoing a fictional note.
6. **Inspect overlaps.** Zone shows two outlined zones and a hatched overlap. Change East's factor to 2: allocated items become 44. Swap priority: 40. Undo restores each step. Geometry creation, polygon vertex editing and snapping are not implemented in this study.
7. **Reconcile.** Review & export identifies four pending allocated detections across two sheets and one uncalibrated page. Resolve next blocker routes to the relevant sheet/control. Accept the results and set Roof plant's 200-unit reference to 10 metres. The demo CSV becomes eligible; source checks and outside-zone items remain separately visible advisories.

Quantity language deliberately distinguishes **raw instances, included instances, included items, allocated items, allocated metres, pending allocated review and export eligibility**. For FP-101: 12 raw − 2 excluded = 10 included instances; source factors produce 18 included items; eight instances inside zones produce 48 allocated items. The two outside-zone instances contribute zero to allocation. Metres never combine with item counts. “Detections reviewed” explicitly does not mean every symbol was found.

The advisory/blocker split is a prototype policy for evaluation, not approval to change production export rules. Whether source-drawing checks should become a formal approval gate needs a separate product decision.

## Verification and limits

11 model tests passed; 27 browser workflow checks passed; 14 further interaction checks passed. Browser scenarios cover A/B correction parity, failure/retry, undo/redo, exclusion/restore, manual addition, notes, scan cancellation, overlap factors, per-sheet view retention, panel restoration, deferred responsive relocation, reconciliation routing and labelled CSV contents. A real browser drag resized the panel to 420px; keyboard ArrowLeft reduced it to 412px; Restore returned 320px. Screenshots were visually reviewed at the three requested sizes. Chrome reported no errors/warnings after fixes. [Machine-readable evidence](../evidence/interactive-prototype-2026-10-29.json) records methods, failures and recoveries.

All 85 protected production code/test/fixture/package/CI files retain their initial hashes. The live production `/api/state` hash is unchanged. No production tests are newly claimed: the previous research checkpoint's 125 passing tests retain their date and context.

The drawing is an original SVG stand-in, not a PDF engine. Recognition is simulated, calibration operates on a seeded measurement, transactions/undo exist only in memory, and the download is fictional CSV rather than production Excel. Three sheets and twelve seeded results per sheet do not validate large drawing sets, realistic recognition accuracy or thousands of marks. No estimator usability sessions have occurred; no speed, error-rate or preference results are invented. The prototype is not a substitute for production architecture or acceptance tests.

## Decision requested

Review the interaction, especially **B at 1280**, **A versus B at 1440**, the density of the quantity inspector and the reconciliation language. Approve the prototype direction or request revisions. The next step is this review; production UI, calculations, project storage and catalogue work remain untouched and gated. Any later implementation needs separate authorisation and staged preservation contracts from the research report.
