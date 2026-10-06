# Requirements and contest-rules compliance

Traceability from every requirement to where it is implemented and how it was verified.

**Sources.** The task requirements come from the *Problem Statement — Tender Document Package Builder*
(§ numbers below). The contest rules come from the rulebook as quoted in the problem statement and the
participant's contest playbook (rule numbers such as 8.2, 8.4, 9.3, 5.5 are cited exactly as they appear
there). The rulebook PDF itself was not available while writing this file — please check §9 of the official
rulebook against the *Submission checklist* at the end.

Legend: ✅ done and verified · ➖ intentionally not part of the final app

## 1. Main tasks (Problem Statement §4)

| # | Requirement | Implementation | Verified by |
|---|---|---|---|
| 4.1 | Open `requirements.json`; show tender details and the required documents sorted by `order` | `src/logic/requirements.js` (`parseRequirements`), Step 1 and Step 3 in `App.jsx` | tests *sample requirements parse and sort*, *shuffled/ties*, *invalid → reasons*; live sample ✅ |
| 4.2 | Upload many PDFs; show name and page count; reject non-PDF with a clear message; remove any file | `files.js` (`inspectPdf`), `addFiles` / `removeFile` in `App.jsx` | tests *file inspection*, *encrypted PDF*; `company_logo.png` rejected live ✅ |
| 4.3 | Match each file to one document; 1 file ↔ ≤ 1 document; change/undo any time | `matchBlocker` in `status.js`; per-row `<select>` in `App.jsx` | test *matching: 1:1 and duplicates* ✅ |
| 4.4 | Enter expiry date when `has_expiry` and a file is matched | date field in the *File and expiry date* cell | live flow ✅ |
| 4.5 | Status for every document, updated immediately after every change | `statusOf` / `allStatuses` (derived on every render) | test *status rules (Section 5)* ✅ |
| 4.6 | Detect duplicate content (even with different names); do not match duplicates to different documents | SHA-256 in `files.js`, `duplicateIds` + `matchBlocker` in `status.js` | `experience_cert.pdf` ≡ `experience_cert (1).pdf` ✅ |
| 4.7 | Generate disabled while blocking statuses exist, and show why; otherwise build one PDF | `canGenerate`, package panel list (`Dossier`), `buildPackage` | live ✅ (blocked → reasons + jump; ready → PDF) |
| 4.8 | Download as `<tender_id>_Package.pdf` | `generate()` in `App.jsx` (Blob + `download` attribute) | live ✅ (`T-2026-0417_Package.pdf`) |
| 4.9 | Switch whole app Bangla ↔ English; names from `title_bn` / `title_en` | `i18n.js`, `LangSwitch` | scan of Bangla mode: no untranslated UI text ✅ |

## 2. Status rules (§5)

| Status | Rule | Blocks | Where / test |
|---|---|---|---|
| Missing | mandatory, no file | Yes | `statusOf` — test *status rules* ✅ |
| Expiry date needed | `has_expiry`, file matched, no (valid) date | Yes | ✅ |
| Expired | expiry date **before** the deadline | Yes | ✅ |
| Not provided | optional, no file | No | ✅ |
| OK | file matched and, if needed, expiry **on or after** the deadline (same day = OK) | No | ✅ (`2026-10-20` vs deadline `2026-10-20`) |

Duplicates are marked in the uploaded-files list (blue tag) ✅.

## 3. Package rules (§6)

| # | Requirement | Implementation | Verified by |
|---|---|---|---|
| 6.1 | Page 1 = English cover: tender ID, title, entity, bidder, deadline, date made, list of included documents in order | `buildPackage` cover section | `pdftotext` of `output/…Package.pdf`; test *package: cover + docs in order* ✅ |
| 6.2 | Documents after the cover, sorted by `order`, all pages in original order; optional documents without file skipped | `copyPages` per document in requirement order | test checks pages 2 (TL), 8 (Technical), 14 (Financial) ✅ |
| 6.3 | Every page incl. cover has footer `<tender_id> | Page X of Y` (Y = total pages) | `footerText` + `drawFooter`, total computed before drawing | `Page 1 of 17` … `Page 17 of 17` ✅ |
| 6.4 | Footer easy to read and never covers content | footer drawn in a 28 pt strip **added below** the page; rotated pages redrawn upright | odd-size / cropped / rotated PDFs rendered and inspected ✅ |

## 4. Bonus tasks (§7)

| Bonus | Status | Notes |
|---|---|---|
| Index page after the cover with start pages | ✅ | Option in Step 4 (default on) |
| Seal or signature PNG on chosen pages | ✅ | Last page of each document / all / custom list; left or right |
| Export checklist as CSV | ✅ | Document, file, pages, expiry date, status; UTF-8 BOM; formula-injection safe |
| Save and reopen work | ✅ | Auto-save in IndexedDB; **Start over** clears |
| Bangla text correct on cover/index | ✅ | Browser-rendered images (`bnPng`) for index titles and non-Latin cover fields |
| Auto-match from file names | ✅ | `automatch.js`; ambiguous cases left to the user |
| Handle bad files safely | ✅ | Non-PDF, damaged, encrypted → clear message, no crash |
| AI help with the user's own API key (§5.5) | ➖ | Built during the contest, then **removed on the participant's request**; the final app contains no AI call and no key handling (the commit history shows both commits) |

## 5. Limits and environment (§8)

| Requirement | Status |
|---|---|
| Frontend only; all processing in the browser; nothing uploaded to participant-controlled storage | ✅ no backend, no upload |
| Up to 30 files / 50 MB total | ✅ enforced (`MAX_FILES`, `MAX_TOTAL_BYTES`), rejected files get a message |
| Runs in latest Google Chrome | ✅ tested in Chrome |
| Libraries: pdf-lib for merging/footers | ✅ `pdf-lib` (pdf.js not needed — no previews) |
| ≥ 1 commit every 30 minutes, ≥ 3 commits; each message states the change and the AI prompt (or *Manual edit*) | ✅ 16+ commits, longest gap < 10 min, every message has `Prompt: "…"` |
| Final commit and public HTTPS deployment by T+90 | ✅ deployed by GitHub Actions (see Actions tab for timestamps) |

## 6. What to submit (§9)

| Item | Where |
|---|---|
| `output/<tender_id>_Package.pdf` generated from the sample pack after resolving its problems | `output/T-2026-0417_Package.pdf` (17 pages) |
| `screenshots/` incl. at least one showing document statuses | `screenshots/07-redesign-statuses-desktop.png`, `09-statuses-bangla-desktop.png`, plus ready/mobile/after-generate shots |
| Public GitHub repository URL | https://github.com/rakibulx33/devfest-241-15-223 |
| Public HTTPS live link, no login | https://rakibulx33.github.io/devfest-241-15-223/ |
| README with: name + registration number, live link, how to run, main features, bonus features, known problems, AI tools used, most useful prompt (rule 9.3) | [`README.md`](../README.md) |
| LICENSE (MIT, participant name, 2026) | [`LICENSE`](../LICENSE) |

## 7. Contest rules checklist

| Rule | Status | Evidence |
|---|---|---|
| 1. Frontend only; no remote DB/storage/serverless | ✅ | Only static files; storage is IndexedDB/localStorage |
| 2. All code written after T+0 in the new repo (8.2); open-source libs and `npm create vite` allowed | ✅ | First commit is the Vite scaffold; libs: React, pdf-lib |
| 3. External APIs optional, HTTPS + CORS; main features work if down | ✅ | The only external requests are Google Fonts (cosmetic) |
| 4. In-app AI optional; key typed by user; never in code/repo | ✅ | AI feature removed; secret scan of the full history is clean |
| 5. Bangla + English everywhere (labels, buttons, statuses, errors, instructions, placeholders, tooltips, empty states); toggle in header, remembered; Noto Sans Bengali | ✅ | `i18n.js`, `LangSwitch`, localStorage `lang`; Bangla-mode scan |
| 6. Commit + push at least every 30 min, ≥ 3 commits; never force-push/rebase/amend pushed commits | ✅ | `git log` — linear history, no rewrites |
| 7. Commit message format (8.4): short note + `Prompt: "<verbatim prompt>"` (or `Manual edit`) | ✅ | Every commit; verified with a script |
| 8. Deadline T+90: nothing after | ✅ | Final commit and deploy before T+90 |
| 9. Test only with organizer sample data; no real personal data | ✅ | `public/sample/` is the organizer pack |
| 10. No hard-coded sample answers; must work on hidden/unseen packs | ✅ | Rules are data-driven; tests include generated PDFs, odd page sizes, ties, bad input |

## 8. Submission checklist

- [x] Public repo, public HTTPS site, no login
- [x] README with all required items, MIT LICENSE
- [x] `output/T-2026-0417_Package.pdf` and `screenshots/`
- [x] Tests green (`npm test`), build green (`npm run build`), lint clean (`npm run lint`)
- [x] Secret scan clean, `npm audit` 0 vulnerabilities
- [x] Final commit hash + live URL copied into the submission form
