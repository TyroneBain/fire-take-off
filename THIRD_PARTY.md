# Third-party dependencies

Fire Take Off's interface, application code and synthetic fixtures are original. No Countfire assets or source are included.

| Component | Installed version | Licence | Purpose |
| --- | --- | --- | --- |
| [PDF.js / pdfjs-dist](https://github.com/mozilla/pdf.js) | 6.4.299 | Apache-2.0 | PDF parsing/rendering, worker, fonts, character maps and codecs |
| [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) | 1.0.13, optional dependency selected by PDF.js | MIT | Node PDF.js platform support; prebuilt platform package selected by npm |

The committed package lock records package URLs and integrity hashes, including optional platform distributions. Dependencies are installed under ignored node_modules, with lifecycle scripts disabled. Their bundled licence files and notices remain part of the installed packages. Any future distributable must preserve those notices and audit bundled font/codec notices; packaging has not been implemented. Node.js/macOS framework licences apply separately to the installed runtimes.

`npm audit --omit=dev --json` reported zero advisories on 2026-10-22. This records that check, not a blanket security guarantee.
