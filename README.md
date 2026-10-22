# Fire Take Off

Private project to build an original functional equivalent of Countfire's takeoff and estimating workflows. This repository currently contains the project foundation and an owned REA diagnostic fixture. Product development has not started.

Start with [permanent instructions](AGENTS.md) and [current verified state](docs/CURRENT_STATE.md).

- [Product vision](docs/PRODUCT_VISION.md)
- [Feature parity and sources](docs/FEATURE_PARITY.md)
- [Observed workflow specifications](docs/WORKFLOW_SPECIFICATIONS.md)
- [Roadmap and phase gates](docs/ROADMAP.md)
- [Architecture recommendation](docs/ARCHITECTURE.md)
- [Decision record](docs/DECISIONS.md)
- [REA setup and evidence](docs/REA_SETUP.md)
- [Development rules](docs/DEVELOPMENT_RULES.md)
- [Testing strategy](docs/TEST_STRATEGY.md)

Repository: https://github.com/TyroneBain/fire-take-off (must remain private).

`apps/` and `packages/` are placeholders; no application framework or product dependencies are selected. `fixtures/rea-smoke/` is a small owned JavaScript application for analysis verification, not a takeoff prototype. Run its behavior checks with `node --test fixtures/rea-smoke/app.test.mjs`.
