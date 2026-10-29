---
name: pdf-recognition-investigation
description: Map the installed PDF pipeline and identify the smallest vector recognition improvement.
---
# PDF recognition investigation

## When to use
Use when assigned a bounded task in this specialty. The lead remains responsible for integration and file ownership.

## Procedure
Read AGENTS.md, docs/PRODUCT_EXECUTION_SOURCE_OF_TRUTH.md and current matcher tests. Inspect current PDF.js version, PDF operators, transforms, clipping, Form XObjects and selection cleanup. Use REA only on our repository. Select an authorized drawing fixture, record expected symbol instances, identify limitations, implement a bounded change only with lead ownership, run regression tests and report TP/FP/FN, latency and failure cases.

## Deliverable
Provide: scope, evidence and source versions, changes or proposed changes, reproducible verification, measured outcomes, failures/unknowns, and next executable action. Do not silently modify unrelated production files.
