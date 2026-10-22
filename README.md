# Fire Take Off

An original, private application working toward Countfire's takeoff and estimating workflows. The first runnable increment provides local projects, takeoffs, disciplines, persistent PDF import, a PDF viewer and page-space notes. Full feature parity is not implemented.

## Run locally

Requires Node 24.22.x and npm. From this directory:

```bash
npm ci --ignore-scripts
npm start
```

Open **http://127.0.0.1:4173**. The service binds only to loopback. Project metadata, immutable PDF originals and pending imports stay in ignored `.local/app/`. Keep that directory when upgrading; it contains your saved work. For a separate store, set `FIRE_TAKE_OFF_DATA` before starting. Use `PORT` to change the loopback port.

Create a project → takeoff → discipline, then import a PDF. This increment supports files up to 25 MiB / 200 pages, rejects same-discipline duplicates, checks source hashes and parses files in bounded child processes. Those are current local limits, not Countfire limits. The viewer supports page navigation, zoom, fit width, rotation and scrolling. Open Notes → Add note, click the drawing, enter text and save. Click a marker or sidebar entry to edit or remove it; notes stay attached through zoom, rotation and reopen. Drawing removal retains the immutable source for a future retention policy.

Automatic symbol recognition, manual corrections, calibration/measurements, zones, revisions, Excel exports, estimating and collaboration are still pending. There is no backup/restore UI or complete project lifecycle yet. Do not assume the local store satisfies cloud access or full parity.

## Verify

```bash
npm test
```

Tests cover hierarchy/persistence, source bytes, bad and duplicate input, concurrent imports, source tampering, drawing removal, local HTTP protections, PDF coordinate round trips, note CRUD/conflicts and database migration. Browser observations are recorded separately in [core evidence](docs/evidence/local-core-2026-10-22.json). Native file-picker import has not been automated because the browser tool denies local upload paths; the actual import API and resulting browser display were tested.

Start each development session with [AGENTS](AGENTS.md) and [CURRENT_STATE](docs/CURRENT_STATE.md). See [FEATURE_PARITY](docs/FEATURE_PARITY.md), [ROADMAP](docs/ROADMAP.md), [DECISIONS](docs/DECISIONS.md), [TEST_STRATEGY](docs/TEST_STRATEGY.md) and [third-party notices](THIRD_PARTY.md).

Repository: https://github.com/TyroneBain/fire-take-off — must remain private. REA live MCP verification passed; see [setup and evidence](docs/REA_SETUP.md). REA fixture inspection never targets Countfire code.
