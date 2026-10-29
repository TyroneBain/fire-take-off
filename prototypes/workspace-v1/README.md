# Fire Take Off — interactive workspace study

Prototype only. Fictional project, original schematic drawings, in-memory demo quantities. No production code imports, API access, project database, external resources or persisted project state. Reload/Reset restores the fixture. This is not a working recognition/PDF-processing/estimating engine.

Open `index.html` directly in a modern browser, or run `node prototypes/workspace-v1/serve.mjs` from the repository root and open http://127.0.0.1:4174. The server serves only this prototype directory and binds loopback. Production remains on its separate port.

Use Auto/A/B/A Compact to compare layouts with the same data. The width presets cap the design viewport; a smaller browser cannot display a larger preset at native scale. Use a suitably sized window or browser emulation for exact dimensions. Prototype scenarios and implementation limits are described in the in-app Study guide.

Tests: `node --test prototypes/workspace-v1/tests/*.test.cjs`. No root package or application changes are required.

See [design choices, A/B comparison and walkthrough](../../docs/design/INTERACTIVE_PROTOTYPE_REVIEW.md), with screenshots at all three requested sizes and measured canvas dimensions.

Try Count → Select example → select a mark → Run demo scan; Review/Properties to accept, reclassify, exclude or edit a factor; Zone to change overlap priority; Review & export to resolve pending detections and Roof plant's missing calibration. The labelled scan reveals seeded results only. The downloadable CSV contains fictional totals, not a production workbook. Study guide includes a recoverable failure scenario.

Browser checks are stored as async function expressions in `tests/browser-scenario.js` and `tests/browser-interactions.js`. Run in the prototype page's browser evaluation context; the latter expects1280×800. These are automated interaction checks, not measured estimator usability results.

Latest refinement: [A Compact recommendation](../../docs/design/A_COMPACT_REVIEW.md) and [side-by-side1440 screenshots](comparison/index.html). Auto now keeps the inspector on the right: Compact below1600 CSSpx, full A above. Open drawings with the launcher/title or Command/Control+K; Escape closes the temporary chooser. Count is initial; Create symbol is the primary next action. Quantity breakdown contains the full explanation. `tests/browser-compact.js` adds13 chooser/status/inspector checks. All layouts use identical fictional data. Large classification/detection volumes remain unvalidated.
