# Fire Take Off

Standing user permission: [private functional and visual Countfire clone](docs/AUTHORIZATION.md). Routine project work is authorised; historical observations and test results retain their original dates.

A private functional and visual Countfire clone, explicitly authorised by Tyrone and independently implemented as Fire Take Off. The first runnable increment provides local projects, takeoffs, disciplines, persistent PDF import, a PDF viewer, page-space notes and editable page metadata. Full feature parity is not implemented.

## Run locally

Requires Node 24.22.x and npm. From this directory:

```bash
npm ci --ignore-scripts
npm start
```

Open **http://127.0.0.1:4173**. The service binds only to loopback. Project metadata, immutable PDF originals and pending imports stay in ignored `.local/app/`. Keep that directory when upgrading; it contains your saved work. For a separate store, set `FIRE_TAKE_OFF_DATA` before starting. Use `PORT` to change the loopback port.

Create a project → takeoff → discipline, then import a PDF. This increment supports files up to 25 MiB / 200 pages, rejects same-discipline duplicates, checks source hashes and parses files in bounded child processes. Those are current local limits, not Countfire limits. The viewer supports page navigation, zoom, fit width, rotation and scrolling. Open Notes → Add note, click the drawing, enter text and save. Click a marker or sidebar entry to edit or remove it; notes stay attached through zoom, rotation and reopen. The Page panel saves page names/titles separately from the immutable PDF; Reset discards unsaved field edits. Drawing removal retains the immutable source for a future retention policy.

Bounded symbol matching, manual corrections, calibration/measurements, zones and Excel export have partial tested implementations. Full recognition, revision workflows, estimating and collaboration remain incomplete. There is no backup/restore UI or complete project lifecycle yet. Do not assume the local store satisfies cloud access or full parity.

## Verify

```bash
npm test
```

Tests cover hierarchy/persistence, source bytes, bad and duplicate input, concurrent imports, source tampering, drawing removal, local HTTP protections, PDF coordinate round trips, note CRUD/conflicts, page metadata and database migrations. Browser observations are recorded separately in [core evidence](docs/evidence/local-core-2026-10-22.json). Native file-picker import has not been automated because the browser tool denies local upload paths; the actual import API and resulting browser display were tested.

Start each development session with [AGENTS](AGENTS.md) and [CURRENT_STATE](docs/CURRENT_STATE.md). See [FEATURE_PARITY](docs/FEATURE_PARITY.md), [ROADMAP](docs/ROADMAP.md), [DECISIONS](docs/DECISIONS.md), [TEST_STRATEGY](docs/TEST_STRATEGY.md) and [third-party notices](THIRD_PARTY.md).

Repository: https://github.com/TyroneBain/fire-take-off — must remain private. REA live MCP verification passed; see [setup and evidence](docs/REA_SETUP.md). REA fixture inspection never targets Countfire code.

Count and measure: open a drawing, choose Count, enter an item name and drag one complete symbol example. Choose a drawing or discipline search scope, then inspect matches and save review decisions. Add missing matches manually. Measure supports points, connected lengths and simple polygon areas; set each page scale using a known length. Return to the takeoff to Export Excel; included matches must be reviewed and length/area pages calibrated. Matching currently requires the same symbol size/orientation and is limited to 20 pages and 4 million pixels/page.

Zone tools: create discipline zone headings, draw page outlines and finish, then edit outlines or reorder headings to change overlap allocation. Earlier headings win; outside outlined regions are excluded. Separate zone columns appear in Excel. Quantities update after saving each outline operation. Pages without outlines include the whole page.
