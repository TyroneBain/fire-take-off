# One coherent task panel

2026-10-29. Response to the owner's tool-distance criticism and instruction to keep the application simple, using the saved Apple design rules and Countfire as the workflow benchmark. Prototype only; production remains gated.

Open [the prototype](http://127.0.0.1:4174/) or [the visual walkthrough](http://127.0.0.1:4174/review/index.html). Offline walkthrough: [review/index.html](../../prototypes/workspace-v1/review/index.html).

## Concrete correction

Count, Measure, Zone and Note now live directly above their working controls in one panel. A and A Compact keep that panel on the right. B remains a comparison arrangement with both tools and information together on the left. No task has its selector across the drawing from its setup controls.

Removed the separate full-width tool strip, the extra Select primary mode, duplicate panel headings and the duplicate internal collapse control. Selection of a symbol remains direct manipulation within Count. Global project, undo/view and panel controls stay in the header; a visible shell control restores the hidden work panel. The drawing gains34px of vertical space after replacing the42px tool strip with an8px taller header.

Count shows Create symbol/Add missing and Symbols/Check/Details. The frequent action and its list share a compact local hierarchy. Selecting a mark keeps Count visibly active. Measure/Zone/Note hide those count-specific tabs and actions. Detailed allocation rules, prototype scope and completeness explanations expand on demand. Removed repeated instructional prose from the default workspace without changing demo numerical rules. Zone labels moved outside their regions to avoid colliding with room labels.

Keyboard arrows move between the four tools and keep focus with the new active tool. Dirty edits prevent accidental tool changes. Skip links give keyboard users direct access to tools or the drawing. Context changes reset the working-list scroll position; ordinary applied corrections retain existing behaviour.

## Task checks, not just screenshots

| Task | Local sequence demonstrated | Result observed |
|---|---|---|
| Count/correct | Count → Create symbol → choose example; or select existing mark → Details → edit factor | Selector/action/list share the panel. Factor2→3 changes48→51 allocated items; undo restores48. Selection remains visibly in Count. |
| Measure/calibrate | Measure → known reference distance → Apply scale | Count controls disappear. Seeded480-unit run with12m reference produces86.4 allocated metres, displayed with rounding; undo restores72. |
| Zone/correct | Zone → zone factor → priority | Zone controls appear directly beneath Zone. East factor2 yields44; swapped priority40; undo restores each. |
| Recover workspace | Collapse panel → shell toggle | Same active tool returns, with drawing view preserved by existing panel behaviour. |

These demonstrate the existing independent fictional model. Genuine PDF source selection, automated matching, new pipe routes and polygon editing are not implemented by this revision.

At1280,1440 and1920, all four tools were checked in A, B and Compact:36 layout/mode combinations. Tool selectors and relevant controls remained inside the same visible panel; headers and documents did not overflow; Count tabs were hidden in other modes. Default Auto canvas sizes are907×646,1067×746 and1358×926 respectively. These are layout measurements, not productivity results.

11 model tests,35 shared workflow checks,14 interaction checks,13 Compact checks and13 new task-panel checks passed. A real Chrome ArrowRight action moved Count→Measure and focus together. Three1440 screenshots were visually inspected. Console had no errors/warnings. [Evidence](../evidence/task-panel-2026-10-29.json) records test-helper failures and fixes. The last small visual adjustments add skip links and reposition zone labels; no production calculations changed.

## Design rationale and limits

This applies the [permanent Apple rules](APPLE_DESIGN_RULES.md): related controls grouped by task, stable locations, document focus, clear hierarchy and progressive disclosure. This specific panel layout is our interpretation, not an Apple-prescribed arrangement. A read-only look at the authorised Countfire demo reinforced the importance of keeping its tool rail and working information adjacent. No reference source or screenshot was saved into the project.

The previous A/B screenshot comparison is now labelled historical; its top-left toolbar is superseded. Do not continue presenting it as the current recommendation.

The prototype still has a small fixture, simulated recognition and original demonstration acceptance/export policies. It is not yet the correct Countfire-equivalent heading/selection/check/save/output workflow. The next product stage should implement that verified sequence with existing numerical protections and owned acceptance fixtures, without adding unnecessary steps. Catalogue remains deferred. Layout revision requires user review before production changes; passing automated checks does not establish perfect UX or full accessibility.
