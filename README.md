# Fire Take Off

**Fire Take Off** is an independently developed, local-first drawing takeoff application focused on fire-protection estimating. It is an active engineering project, not a production-ready service.

The goal is to make counting symbols, measuring drawing geometry, reviewing quantities and preparing exports easier to verify.

## Current capabilities

- Create local projects, takeoffs and disciplines; import and view PDFs.
- Count drawing symbols using bounded example matching, with colour-coded marks and manual review/correction.
- Capture point, length and area measurements with page-scale calibration.
- Define zones and allocate quantities, including overlap rules and quantity multipliers.
- Compare or overlay drawings, arrange related floor-plan sheets and recount revised drawings.
- Export reviewed quantities and calculation history to Excel.

**Important limitations:** Automatic symbol recognition is still a partial implementation and currently requires matching size/orientation. It has not demonstrated reliable accuracy across a representative set of real construction drawings. Users must review detections and validate measurements before relying on exports. Cloud collaboration, full revision management, production authentication and a complete estimating workflow are not implemented.

## Run locally

Requires **Node.js 24.22.x** and npm.

```bash
npm ci --ignore-scripts
npm start
```

Open **http://127.0.0.1:4173**. The application binds to loopback rather than a public network interface. Its local project data and imported originals live in the ignored `.local/app/` directory; preserve that directory if you want to retain your local work.

To run the automated test suite:

```bash
npm test
```

The repository includes automated tests, owned synthetic drawing fixtures, evidence records and an isolated UI prototype. Passing synthetic tests does not establish real-world takeoff accuracy.

## Engineering notes

- [Current implementation and known limitations](docs/CURRENT_STATE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature status](docs/FEATURE_PARITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Test strategy](docs/TEST_STRATEGY.md)
- [Agent and development instructions](AGENTS.md)
- [Independent development and IP boundaries](docs/AUTHORIZATION.md)
- [Third-party dependencies](THIRD_PARTY.md)

Development focuses on original implementation, reproducible testing and transparent reporting of unsupported workflows. Do not add credentials, private customer drawings or personal data to the repository.

## Reuse

The source is publicly viewable, but no general open-source licence is provided by this repository. Obtain permission before redistributing or commercially reusing it. Third-party dependencies have their own licences, listed in [THIRD_PARTY.md](THIRD_PARTY.md).
