# Original drawing research corpus

Run `node scripts/generate-drawing-fixture.mjs` from the repository root. It writes an original single-page vector PDF and labelled manifest to ignored `.local/drawing-fixture/`. An optional output directory is the first argument. Generated PDFs remain untracked.

The page is 595 × 842 PDF points, with a bottom-left origin. Six square-cross symbols have centres at x=100/200/300 and y=100/200. The calibration segment spans 300 points and represents 30 metres. The bent run has 300 + 200 points, therefore 50 metres. The 100 × 100 point rectangle represents 100 square metres. The outlined zone encloses all six symbols strictly inside its boundary. These expectations come from the declared geometry, not a recognition implementation.

All geometry and text are original project material. No Countfire asset, private drawing, account value or third-party template is included. This is a research fixture, not a construction plan or a trade accuracy benchmark. The generator is independent of any proposed application stack.

Still required for Phase 1: raster variants, rotations/crops, multi-page and large sets, independent PDF rendering/inspection, revision pairs, overlapping/boundary zones, trade-specific evaluation labels and measured performance budgets. Passing PDF structural checks does not establish visual fidelity or product acceptance.
