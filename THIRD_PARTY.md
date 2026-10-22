# Third-party dependencies

Fire Take Off is authorised by Tyrone as a private functional and visual clone; see [the standing authorisation](docs/AUTHORIZATION.md). Its application code and synthetic fixtures are original. No Countfire assets or source are included. This dependency ledger records actual third-party licences separately from the user's project permission.

| Component | Installed version | Licence | Purpose |
| --- | --- | --- | --- |
| [PDF.js / pdfjs-dist](https://github.com/mozilla/pdf.js) | 6.4.299 | Apache-2.0 | PDF parsing/rendering, worker, fonts, character maps and codecs |
| [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) | 1.0.13, optional dependency selected by PDF.js | MIT | Node PDF.js platform support; prebuilt platform package selected by npm |

The committed package lock records package URLs and integrity hashes, including optional platform distributions. Dependencies are installed under ignored node_modules, with lifecycle scripts disabled. Their bundled licence files and notices remain part of the installed packages. Any future distributable must preserve those notices and audit bundled font/codec notices; packaging has not been implemented. Node.js/macOS framework licences apply separately to the installed runtimes.

`npm audit --omit=dev --json` reported zero advisories on 2026-10-22. This records that check, not a blanket security guarantee.

ExcelJS 4.4.0 (MIT, https://github.com/exceljs/exceljs) writes original XLSX workbooks. Its scoped UUID dependency is pinned to 11.1.1 (MIT) to address GHSA-w5hq-g745-h8pq; CommonJS v4 usage was checked and workbook tests pass. The initial audit reported one moderate advisory; the repeat after this override reported zero. npm emitted transitive deprecation notices (rimraf, inflight, fstream, lodash.isequal, glob and uuid). All exact dependencies/integrity hashes remain in package-lock.json; lifecycle scripts disabled.

[polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 (MIT), with robust-predicates and splaytree, provides server-side zone union/intersection/difference. Pinned installation with scripts disabled reported zero advisories (2026-10-22). Preserve its bundled MIT notices in future distribution. Initial sandbox DNS install failed; permitted network install succeeded.
