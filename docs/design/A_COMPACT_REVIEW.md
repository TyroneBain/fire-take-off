# A Compact — final layout recommendation for approval

2026-10-29. Focused refinement of the existing interactive study, following Tyrone's feedback. Production code, calculations and saved data remain untouched. This is a proposed layout decision, not production approval or Countfire workflow parity.

**Recommendation: A Compact at 1280 and 1440; full A at 1920. Keep the quantity inspector on the right throughout.** B remains available for comparison, but should not be the automatic laptop adaptation. The small extra canvas area it provides is outweighed, in my design judgment, by replacing quantities with drawing navigation and moving the inspector to the opposite side. No estimator preference results are claimed.

Open the [interactive prototype](http://127.0.0.1:4174/) and the [side-by-side screenshot comparison](http://127.0.0.1:4174/comparison/index.html). Offline: [prototype](../../prototypes/workspace-v1/index.html) and [comparison](../../prototypes/workspace-v1/comparison/index.html). Start with `node prototypes/workspace-v1/serve.mjs` if needed.

## What changed

- A Compact has a **48px drawing launcher**, previous/next drawing actions and a **320px right inspector**. Opening drawings reveals a 304px temporary chooser. Search, keyboard arrows and Enter select a sheet; Escape or clicking outside dismisses it. Command/Control+K opens it. Switching drawings retains the current tool and restores that sheet's zoom.
- The chooser does not resize/recentre the canvas or move the inspector. It closes after a selection. Full A remains the explicit option for frequent sheet hopping.
- Auto now uses Compact below1600 CSSpx and A at/above1600. This provisional breakpoint changes only the navigation treatment. Active edits defer adaptation; explicit A/B/Compact overrides remain available.
- Count is the initial tool. A stronger blue active-tool state and amber **Create symbol** action establish the working hierarchy. Project export is a quieter global control. This prototype still selects a seeded example; drawing a genuine selection and matching it is not implemented here.
- The drawing strip shows one allocated total and the outside-zone exception. Classification rows show allocated quantities and a subdued instance count. Raw/included/source-factor/zone-factor explanations move into **Quantity breakdown**, available by clicking the drawing total or opening the disclosure. Full project reconciliation remains accessible.
- The drawing review action explicitly says **“Review 3 on this drawing.”** The separate project control says **“Project export · 4 reviews · 1 scale.”** Reviews and scale issues are no longer combined into an unexplained5.
- Replaced large classification cards with compact aligned rows, increased working tool labels, strengthened selected-state boundaries and reduced borders, repeated totals, repeated review badges and instructional prose on the default workspace. The original graphite/white/amber/blue roles remain.

These changes apply the Apple study's principles of stable spatial organisation, clear hierarchy, direct contextual actions and progressive disclosure. They are our application-specific design decisions, not claims that Apple prescribes these exact dimensions or layouts. The [existing source register](SOURCE_REGISTER.md) remains the research basis; this phase did not restart the research programme.

## Controlled comparison

All screenshots use **FP-101, its unchanged fictional quantities, Count/Items, 1440×900 CSSpx and80% zoom**, centred on the same point. Shared styling and default panel widths isolate arrangement differences. Native images: [A](../../prototypes/workspace-v1/comparison/1440-a.jpg), [B](../../prototypes/workspace-v1/comparison/1440-b.jpg), [Compact](../../prototypes/workspace-v1/comparison/1440-compact.jpg), [Compact chooser open](../../prototypes/workspace-v1/comparison/1440-chooser.jpg).

| Viewport | A canvas | B canvas | A Compact canvas | Whole sheet visible at80%: A / B / Compact |
|---|---|---|---|---|
| 1280×800 |718×612|955×612|907×612|54.49% /72.48% /68.83%|
| 1440×900 |878×712|1115×712|1067×712|77.52% /98.45% /94.21%|
| 1920×1080 |1358×892|1595×892|1547×892|100% /100% /100%|

The rendered white sheet is1120×720 at this zoom. “Visible” means the intersection of that sheet with unobstructed canvas; grey margins do not count. These are browser geometry measurements of a PDF stand-in, not PDF rendering/performance results or productivity scores.

At1440, Compact gains189px over A and shows94.21% of the sheet versus77.52%. It gives up48px and4.24 percentage points of sheet visibility to B. At1920, **all three expose the whole sheet** at the controlled zoom: the extra width of B/Compact adds no visible sheet area in this case. Full A's immediately available navigator then has a stronger justification. At higher zoom or with different sheet proportions the tradeoff will change; Fit remains available.

**The chooser has a real cost:** at1440 it covers214,016 square CSS pixels of the drawing, temporarily reducing unobstructed sheet visibility to67.67%. That is worse than A while the chooser is open. Compact is appropriate because navigation is transient; it is not a permanent floating panel to leave over the drawing. Selection/Escape/outside-click dismissal, previous/next actions and full A are necessary parts of the design.

## Workflow and consistency comparison

| Task | A | B | A Compact |
|---|---|---|---|
| Choose another visible drawing | One click in permanent list | Drawings tab, then sheet | Launcher/title, then sheet; or one previous/next action |
| Find a distant drawing | Search visible list | Open Drawings, search | Command/Control+K, search, Enter |
| Keep quantity details visible while choosing | Yes | No: chooser replaces inspector | Yes: inspector stays right |
| Preserve drawing unobstructed during navigation | Yes, within smaller canvas | Yes, within shared-panel canvas | Temporary overlay obscures part of drawing |
| Return to counting | Current tool retained | Current tool retained | Current tool retained; chooser closes |
| Adapt between laptop and monitor | Navigator consumes space | Inspector changes side if paired with A | Inspector stays right; only navigator changes |

Click counts describe the available control paths, not human task timings. No claim is made that fewer clicks alone wins. Compact's advantage is a predictable inspector and persistent quantity context at a modest48px cost compared with B.

## Your Countfire workflow criticism

The earlier study mixed layout validation with several original workflow proposals. That was too easy to read as the intended final application. **The layout can be approved without accepting those demonstration workflows.** Per-result Accept, the simulated scan stages, the source-check advisory and the prototype export gate must not be treated as observed Countfire requirements.

A focused recheck of Countfire's [new takeoff guide](https://www.countfire.com/blog/new-takeoff-experience) confirms a Count-first entry, a drawing chooser accessible from the current tool, Space panning, explicit saving, symbol/group actions and measurement-type selection before creation. The current authorised demo's read-only snapshot also showed Save and Count/Measure/Zone/Note/Layout/Page controls. This does not verify every workflow. A separate counting-help URL failed to load and was not used as evidence.

This refinement adopts Count-first entry and continuous drawing access. The next workflow pass, after layout approval, should match the actual reference task sequence and remove invented steps:

1. **Count headings and selections:** create/name a symbol heading, select source geometry, add variants to the same heading, match across the intended discipline/drawings, inspect and amend selections. The current prototype's category click simply opens one instance; that is not heading-workflow parity.
2. **Checking and corrections:** reproduce observed checking, missed/false/duplicate correction and classification behaviour. Do not impose one-by-one acceptance or a new approval ceremony without evidence or a deliberate user decision.
3. **Drawing and tool context:** retain heading, current tool, per-drawing view and intended scope while changing sheets; reproduce the relevant documented shortcuts. Prototype Command/Control+K is our convenience shortcut, not Countfire's documented Space+D.
4. **Measurement and zones:** verify creation/type/snapping/editing/calibration, overlap and omission rules against the reference. The fixed-zone and seeded-measurement controls here remain demonstrations.
5. **Save, processing and outputs:** reproduce observable unsaved/Save/error behaviour and the real check/output sequence, then reconcile existing Fire Take Off calculations and Excel outputs. Memory-only demo state and CSV are not substitutes.

Use the existing workflow specifications, parity inventory and owned test fixtures. Catalogue stays deferred. No source-code copying, private drawing export or new reference account mutations were performed in this refinement.

## Larger jobs

The layout reserves full panel height for the working list rather than permanent explanations. This prototype adds classification search, scrolling drawing navigation, keyboard chooser navigation and a25-row bounded review list. Search never changes quantity/export scope. These are useful foundations, but **the visible fixture still has3 drawings,2 classifications and12 seeded results per sheet**. This is not evidence that hundreds of classifications or thousands of detections are production-ready.

Before production approval of high-volume workflows: test an owned fixture with50+ drawings,200+ named/grouped classifications and5,000+ detections. Validate grouped heading search, preserved selection/scroll position, bounded or virtualised result lists, canvas hit-testing, next/previous result centring and rendering responsiveness. Group creation and heading interactions should follow the reference workflow, not grow into a generic catalogue. Keep the current compact row hierarchy; avoid rendering thousands of inspector controls at once. These are proposed acceptance tasks, not results already obtained.

## Verification and remaining objections

11 model tests passed. The shared correction/export browser scenario now covers A, B and Compact:35 checks passed.14 interaction regression checks and13 Compact-specific checks passed, including chooser dismissal, tool/zoom retention, right-side restore/resize, filtering, quantity disclosure and distinct status scopes. All nine screen/layout combinations fit without document horizontal overflow or summary overflow. Four comparison images loaded at native1440px width. Console showed no errors/warnings. Evidence: [compact-prototype-2026-10-29.json](../evidence/compact-prototype-2026-10-29.json).

85 protected production files and the live saved-state hash remain unchanged. These prototype results do not promote production feature statuses. Existing product tests were not rerun for isolated prototype changes. No screen-reader certification, realistic PDF performance or estimator task study is claimed.

Remaining objections: the launcher adds48px of permanent overhead; temporary navigation obscures geometry; the1600 breakpoint is provisional; the compact type needs prolonged-use feedback; a search field does not replace a properly implemented heading/group hierarchy. Full A should remain an intentional choice for sustained cross-sheet work. The study's simulated workflow must be replaced by verified reference behaviour before anyone calls the product a functional clone.

**Approval requested:** approve A Compact→A as the layout family, stable right inspection, the quieter quantity hierarchy and separate drawing/project status language. Treat workflow parity as the next explicit validation/implementation stage, not as approved by this visual prototype. Production remains gated until Tyrone explicitly authorises that work.
