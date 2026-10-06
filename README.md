# Tender Document Package Builder

**AI DevFest 2026 — Vibe Coding Contest (Solo)** · frontend-only web app that turns a tender's `requirements.json`
and a set of PDF files into **one checked, correctly ordered PDF package** (cover page, documents in tender order,
`<tender_id> | Page X of Y` footer on every page), in **English and Bangla**.

| | |
|---|---|
| **Name** | Rakibul Hasan |
| **Registration no.** | 241-15-223 |
| **Live site (HTTPS)** | https://rakibulx33.github.io/devfest-241-15-223/ |
| **Repository** | https://github.com/rakibulx33/devfest-241-15-223 |
| **Stack** | Vite + React (JavaScript), [pdf-lib](https://pdf-lib.js.org/), deployed with GitHub Actions → GitHub Pages |
| **Licence** | MIT |

Everything runs in the browser: no backend, no upload, no account. Files stay on the user's computer.

## Documentation

| Document | What is in it |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | How to use the app, step by step, with the sample pack — **English and Bangla** |
| [docs/SETUP.md](docs/SETUP.md) | Install, run, test, build, deploy to GitHub Pages, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architecture: modules, data flow, rules engine, PDF builder, storage, security, background processing |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Requirement-by-requirement traceability and the contest-rules checklist |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  -> click "Load sample tender" and "Load sample documents"
npm test           # 14 unit tests
npm run build      # production build in dist/
```

Details and troubleshooting: [docs/SETUP.md](docs/SETUP.md).

## How to use (short)

1. **Tender requirements** — open `requirements.json` (or *Load sample tender*). Tender details and the required
   documents appear, sorted by `order`. A bad file is rejected with a bilingual list of problems.
2. **Upload PDF files** — choose or drag-drop many files. Each shows name and page count. Non-PDF, damaged and
   password-protected files are rejected with a clear message; identical-content files are marked **Duplicate**.
3. **Match files and check** — pick a file for each document (one file ↔ one document), enter expiry dates where
   asked. Every document shows one live status: **Missing**, **Expiry date needed**, **Expired**,
   **Not provided** or **OK** (icon + text + colour).
4. **Package options → Generate** — choose the index page / seal, then press **Generate package PDF**. The button
   stays off while any blocking status exists and lists why. The result downloads as `<tender_id>_Package.pdf`.

Full guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## How it works (short)

- `src/logic/*` — pure, unit-tested modules: validate `requirements.json`, inspect files (PDF check by content,
  SHA-256 for duplicates, page count), derive statuses, suggest matches, build the PDF with pdf-lib, save to IndexedDB.
- `src/App.jsx` — holds all state; **statuses are derived** from `matches` + `expiry` + deadline on every render,
  so they update instantly.
- **PDF building** — cover page → optional index → `copyPages` of each document in requirement order. The footer
  is drawn in a **28 pt strip added below** every page so it can never cover content; rotated pages are redrawn
  upright first.
- Bangla on the PDF (index, non-Latin cover fields) is rendered to PNG by the browser's own text engine (correct
  conjunct shaping) and embedded.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams and the full walk-through.

## Main features (all done)

- **4.1** Load + validate `requirements.json` (clear EN/BN error list; one title is enough, the other language falls back to it), tender details, requirements sorted by `order`
- **4.2** Multi-file upload with page counts; non-PDF rejection (by content, not only extension); remove any file; 30 files / 50 MB limit
- **4.3** One-to-one matching, change or undo at any time
- **4.4** Expiry date entry for `has_expiry` documents
- **4.5** Live status per Section 5 (same-day expiry = OK)
- **4.6** Duplicate detection by SHA-256 of content; duplicates cannot be matched to different documents
- **4.7** Generate disabled with reasons while blocking statuses exist (and pressing it takes you to the first problem)
- **4.8** Download as `<tender_id>_Package.pdf`
- **4.9** Whole app in English / Bangla (remembered), names from `title_en` / `title_bn`
- **Package (Section 6)** English cover page → documents in `order` with all pages in original order (optional
  documents without a file skipped) → footer `<tender_id> | Page X of Y` on every page, never covering content

## Bonus features

- Index page after the cover with the start page of each document
- Bangla text shown correctly on the PDF index page and for non-Latin tender text on the cover
- Seal or signature PNG on chosen pages (last page of each document / every page / custom list such as `3, 5-7`)
- Auto-match from file names (ambiguous cases are left to the user)
- Export checklist as CSV (document, file name, pages, expiry date, status)
- Save and reopen work (auto-saved in the browser, restored on reload)
- Bad files handled safely: damaged or password-protected PDFs give a clear message, never a crash
- *AI help with the user's own API key* was built and then removed again on request — the final app has no AI calls

## Sample pack result

Problems the app finds in the organizer sample pack: `company_logo.png` is not a PDF · `experience_cert.pdf` and
`experience_cert (1).pdf` are duplicates · `trade_license_2025.pdf` expired on 2025-06-30 (before the 2026-10-20
deadline), so `trade_license_2026.pdf` (valid to 2027-06-30) is used · `scan_0042.pdf` is the signed declaration ·
`01_financial` / `02_technical` are numbered opposite to the tender order · optional R06 and R07 are not provided.

Output: [`output/T-2026-0417_Package.pdf`](output/T-2026-0417_Package.pdf) — cover + index + 15 document pages =
**17 pages** (16 without the index). Screenshots are in [`screenshots/`](screenshots/): `07` document statuses
(English), `09` document statuses (Bangla), `05` ready state, `08` after generating, `06` phone layout (Bangla).

## Project structure

```
index.html · vite.config.js · package.json
src/
  main.jsx           entry point
  App.jsx            state, handlers, page layout
  ui.jsx             Icon, Step, StatusStamp, LangSwitch, package panel (Dossier)
  motion.js          reduced-motion check, count-up, click ripple
  i18n.js            English / Bangla dictionaries + t()
  App.css            design tokens, layout, components, motion, responsive rules
  logic/
    requirements.js  parse + validate requirements.json
    files.js         PDF check by content, SHA-256, page count, encrypted/damaged detection
    status.js        statuses, duplicates, matching rules
    automatch.js     name-based match suggestions
    pack.js          cover, index, merge, footer strip, seal, Bangla/non-Latin images
    saved.js         IndexedDB save/restore
public/sample/       organizer sample pack (requirements.json + documents/)
tests/logic.test.js  14 node:test checks
docs/                user guide, setup, architecture, requirements matrix
output/ · screenshots/ · .github/workflows/deploy.yml
```

## Testing and quality

- `npm test` — 14 checks: parsing/sorting, validation errors, the status table (incl. same-day expiry), file
  inspection (non-PDF, duplicates, damaged, encrypted), matching rules, the sample package (page count, order,
  footers), rotated pages, auto-match, seal placement, curly quotes / Bangla cover handling.
- `npm run lint` — 0 warnings · `npm audit` — 0 vulnerabilities · CI runs tests before every deploy.
- Checked by hand in Chrome: full sample flow on the live site in both languages, 375 px mobile width, keyboard
  focus, reduced-motion, odd PDF page sizes / crops / rotations, Content-Security-Policy.

## Security and privacy

- Everything runs in the browser; no file or data is sent to any server. Saved work stays in this browser's IndexedDB.
- Strict Content-Security-Policy meta tag (own scripts only; Google Fonts for fonts/styles; `blob:`/`data:` images),
  `no-referrer`; no inline scripts, `eval` or `innerHTML`; all text is escaped by React.
- Files are identified by content (`%PDF-` header) and parsed by pdf-lib in the page; never executed.
- CSV export neutralises spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes).
- No keys, tokens or secrets in code or history.

## Contest rules compliance

Frontend only · all code written after T+0 in this repo · bilingual UI with remembered toggle (Noto Sans Bengali) ·
commits at least every 30 minutes, every message ends with `Prompt: "…"`, no force-push or rewritten history ·
no secrets · sample data only · no hard-coded answers. Full checklist: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Known problems / limits

- If a tender title, entity or bidder contains Bangla, that cover line is drawn as an image (not selectable text);
  the same applies to the Bangla titles on the index page. The rest of the cover is English as Section 6.1 requires.
- Rotated pages are redrawn upright; links and form fields on those pages are not kept.
- A PDF that opens but has broken page content is not detected — only unreadable, empty or password-protected PDFs are rejected.
- Fonts (Public Sans, Noto Sans Bengali) load from Google Fonts; offline the app falls back to system fonts.
- Saved work lives only in the browser that created it; no PDF preview thumbnails.
- Assumptions made without organizer confirmation (Q&A window): an optional document that is matched but expired
  still shows **Expired** and blocks; requirements with the same `order` are sorted by `id`; the cover date uses `YYYY-MM-DD`.

## AI tools used

- **Claude Code** (Claude Opus 5.5; Claude Sonnet 5.5 for the last part of the session) — problem analysis, planning,
  code, tests, browser checks and documentation, driven by the prompts quoted in the commit messages.

## Most useful prompt

> "/home/rax/Desktop/Vibe Coding Contest/AIDevFest-ViveCoding_ProblemStatement.pdf this the contest problem now analyze it and make a build plan and follow the contest rules"

## Licence

MIT — see [LICENSE](LICENSE).
