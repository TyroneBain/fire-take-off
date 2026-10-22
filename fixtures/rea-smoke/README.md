# Owned REA smoke fixture

Original diagnostic application written for this project, 2026-10-22. Contains no Countfire code, drawings or third-party assets. It has no dependencies, network access, native code or Electron APIs.

`app.mjs` imports `totalCost` from `calculation.mjs`, exports `quoteSummary`, and prints `{"quantity":3,"total":37.5}`. `calculation.mjs` exports one function and rejects invalid inputs. The test file imports these modules and Node's test/assert built-ins. REA should identify JavaScript modules and this local dependency; it should not infer Electron main/preload/renderer boundaries.

Run `node fixtures/rea-smoke/app.mjs` and `node --test fixtures/rea-smoke/app.test.mjs` from repository root. These behavior checks establish source ground truth, not REA success; compare an actual analysis against these facts separately.
