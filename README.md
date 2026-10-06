# Tender Document Package Builder

AI DevFest 2026 — Vibe Coding Contest (Solo)

- **Name:** Rakibul Hasan
- **Registration no:** 241-15-223
- **Live site:** https://rakibulx33.github.io/devfest-241-15-223/
- **Repository:** https://github.com/rakibulx33/devfest-241-15-223

A frontend-only web app that helps office staff turn a set of PDF files into one complete,
checked and correctly ordered tender package PDF. Everything runs in the browser — no file
is uploaded anywhere.

## How to run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm test         # node --test: status rules, validation, duplicates, PDF package checks
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`
(the workflow runs the tests before building).

## How to use

1. **Step 1** — open `requirements.json` (or click *Load sample tender*). Tender details and the
   required documents are shown, sorted by `order`. Malformed files are rejected with a list of problems.
2. **Step 2** — choose or drag-drop many files (or *Load sample documents*). Each file shows its name and
   page count. Non-PDF, damaged and password-protected files are rejected with a clear message.
   Files with identical content are marked **Duplicate**. Any file can be removed.
3. **Step 3** — pick a file for each required document (one file per document, one document per file;
   duplicates cannot be used for two documents). Enter expiry dates where needed. Each row shows its
   status live: **Missing**, **Expiry date needed**, **Expired**, **Not provided**, **OK**
   (icon + text + colour).
4. **Step 4** — choose package options (index page, optional seal). The **Package panel** (right side on desktop, bottom bar on phones) shows a live paper stack with the page count, one coloured segment per document, and the list of problems — click a problem to jump to its row. *Generate package PDF* stays disabled while any blocking status exists; when ready it downloads `<tender_id>_Package.pdf`.

## Design

Bottle-green and paper palette, Public Sans + Noto Sans Bengali, numbered step rail, status "stamps" (icon + text + colour, never colour alone), sliding EN/বাংলা switch, live package panel with animated page count, mobile bottom bar, 375 px layout, visible keyboard focus, `prefers-reduced-motion` respected.

## Main features (all done)

- 4.1 Load + validate `requirements.json`, show tender details, requirements sorted by order
- 4.2 Multi-file upload with page counts; non-PDF rejection (checked by file content, not only name); remove file; 30 files / 50 MB limit
- 4.3 One-to-one matching, change or undo any time
- 4.4 Expiry date entry for `has_expiry` documents
- 4.5 Live status per Section 5 (same-day expiry = OK)
- 4.6 Duplicate detection by SHA-256 of file content; duplicates cannot be matched to different documents
- 4.7 Generate disabled with reasons while blocking statuses exist
- 4.8 Download as `<tender_id>_Package.pdf`
- 4.9 Full English / Bangla switch (remembered), titles from `title_en` / `title_bn`
- Package (Section 6): English cover page (tender ID, title, entity, bidder, deadline, generation date,
  included documents in order) → documents in `order`, all pages in original order, optional documents
  without a file skipped → footer `<tender_id> | Page X of Y` on every page. The footer is drawn in a
  new white strip **added below** each page, so it never covers document content. Rotated pages are
  turned upright first so the footer is always at the visual bottom.

## Bonus features

- Index page after the cover showing the start page of each document (checkbox, on by default)
- Bangla text shown correctly on the index page: each `title_bn` is rendered by the browser's text engine (correct Bangla conjuncts) into a PNG and placed next to the English title
- Seal or signature: upload a PNG and place it on the last page of each document, every document page, or a custom page list (e.g. `3, 5-7`), bottom-right or bottom-left, above the footer
- Auto-match: suggests matches from file names; ambiguous cases (e.g. two trade licences) are left for the user
- Export checklist as CSV (document, file name, pages, expiry date, status) — UTF-8 with BOM so Excel shows Bangla
- Bad files handled safely: damaged or password-protected PDFs show a clear message
- Save and reopen work: the whole project (requirements, files, matches, dates) is auto-saved in the browser (IndexedDB) and restored after reload; "Start over" clears it

## Sample pack result

Problems found in the sample pack: `company_logo.png` is not a PDF; `experience_cert.pdf` and
`experience_cert (1).pdf` are duplicates; `trade_license_2025.pdf` expired on 2025-06-30 (before the
2026-10-20 deadline) — use `trade_license_2026.pdf` (valid to 2027-06-30); `scan_0042.pdf` is the signed
declaration; file numbers `01_financial` / `02_technical` are in the opposite order to the tender.
Optional documents R06 and R07 are not provided.

Output: [`output/T-2026-0417_Package.pdf`](output/T-2026-0417_Package.pdf) — cover + index + 15 document pages = 17 pages.
Screenshots: [`screenshots/`](screenshots/).

## Known problems / limits


- The cover page is English only (Section 6.1). Bangla titles on the index are images, so they are not selectable text.
- Rotated pages are redrawn upright; on those pages links/form fields from the original are not kept.
- Saved work lives only in this browser (IndexedDB); it is not shared between devices.
- No PDF preview thumbnails.

## AI tools used

- Claude Code (Claude Opus 5.5) — analysis of the problem statement and sample pack, planning, code, tests, browser checks.

## Most useful prompt

> "/home/rax/Desktop/Vibe Coding Contest/AIDevFest-ViveCoding_ProblemStatement.pdf this the contest problem now analyze it and make a build plan and follow the contest rules"

## Tech

Vite + React, [pdf-lib](https://pdf-lib.js.org/) (merge, page count, footer), Web Crypto (SHA-256).
