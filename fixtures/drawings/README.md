# Original drawing research corpus

Run `node scripts/generate-drawing-fixture.mjs` from the repository root. It writes an original single-page vector PDF and labelled manifest to ignored `.local/drawing-fixture/`. An optional output directory is the first argument. Generated PDFs remain untracked.

The page is 595 × 842 PDF points, with a bottom-left origin. Six square-cross symbols have centres at x=100/200/300 and y=100/200. The calibration segment spans 300 points and represents 30 metres. The bent run has 300 + 200 points, therefore 50 metres. The 100 × 100 point rectangle represents 100 square metres. The outlined zone encloses all six symbols strictly inside its boundary. These expectations come from the declared geometry, not a recognition implementation.

All geometry and text are original project material. No Countfire asset, private drawing, account value or third-party template is included. This is a research fixture, not a construction plan or a trade accuracy benchmark. The generator is independent of any proposed application stack.

Raster, rotated/cropped, repeated 10/100-page and revision variants are now generated and independently reopened with Apple PDFKit. Still required: realistic construction complexity, crop viewport checks, overlapping/boundary geometry, trade-specific labels and measured/accepted performance budgets. Research fixture passes do not establish product acceptance.


## Reproduction on macOS

```bash
node scripts/generate-drawing-fixture.mjs
swiftc -module-cache-path /private/tmp/fire-take-off-swift-cache scripts/inspect-drawing-fixture.swift -o /private/tmp/fire-take-off-inspect-pdf
/private/tmp/fire-take-off-inspect-pdf .local/drawing-fixture/small-vector.pdf .local/drawing-fixture/render
swiftc -module-cache-path /private/tmp/fire-take-off-swift-cache scripts/derive-drawing-corpus.swift -o /private/tmp/fire-take-off-derive-corpus
/private/tmp/fire-take-off-derive-corpus .local/drawing-fixture/small-vector.pdf .local/drawing-fixture/render/page-1.png .local/drawing-corpus
node scripts/generate-drawing-fixture.mjs .local/drawing-corpus/revision revision
```

Inspect a derived PDF with the same inspector; add `--metadata-only` to avoid rendering every page in repeated-page sets. Images/PDFs and compiler caches stay outside Git. The oracle uses installed macOS frameworks; this does not adopt Swift/PDFKit as the product stack.

The revision removes (100,100) and adds (350,150), retaining five other centres and the aggregate count of six. IDs are local to each generated manifest; coordinate differences provide the independent revision oracle. Raster geometry derives from our inspected 2x render and has no selectable text layer. Derived PDF bytes can differ between runs because PDFKit may add metadata; evidence records the actual hashes.

The dependency-free generator also accepts `cropped` as its third argument. This produces the same original geometry with CropBox `[40,40,440,740]` and source rotation 90 degrees for reproducible note-transform tests without a macOS framework dependency. Base PDF bytes remain unchanged (SHA-256 `5134016a0ce1d885aead56527ef531f38b5ea0e0927ef939b691e1c45a41d0ca`).

The independent asymmetric pixel corpus in `tests/recognition-negative-controls.test.mjs` labels two complete same-size/orientation symbols, one symbol without the erased detail, a dense block, a 90-degree rotation and a doubled-size variant. Coordinates are declared independently of detector output. Cleaned-template tests require the three supported forms and reject the block; rotated/scaled forms deliberately document the current unsupported scope. This is a negative-control corpus, not evidence of trade drawing accuracy. Actual vector PDF rendering and unchanged six-symbol anchors remain tested separately in `tests/selection-editing.test.mjs`.
