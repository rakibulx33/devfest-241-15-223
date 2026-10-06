# Setup guide

How to install, run, test, build and deploy the Tender Package Builder.

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22 LTS (20.19 or newer also works) | everything |
| npm | comes with Node | installing dependencies |
| Google Chrome (latest) | latest | running the app (the contest requires latest Chrome) |
| `pdftotext` (poppler-utils) | optional | extra footer-text assertions inside `npm test`; the tests skip them if it is missing |
| git | any | cloning / contributing |

No environment variables, API keys or accounts are needed to run or build the project.

## 2. Install and run

```bash
git clone https://github.com/rakibulx33/devfest-241-15-223.git
cd devfest-241-15-223
npm install
npm run dev          # http://localhost:5173  (Vite dev server with hot reload)
```

Open the printed URL in Chrome, click **Load sample tender** and **Load sample documents** to try the bundled
organizer sample pack immediately.

## 3. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (`http://localhost:5173`) |
| `npm run build` | Production build into `dist/` (relative asset paths, `base: './'`) |
| `npm run preview` | Serves the production build locally (`http://localhost:4173`) — use this to test the Content-Security-Policy exactly as deployed |
| `npm test` | Runs `node --test tests/*.test.js` (14 checks, ~1 s) |
| `npm run lint` | Runs oxlint (0 warnings expected) |

> The dev server injects inline scripts for hot reload, which the production Content-Security-Policy would block.
> That is why CSP behaviour should be checked with `npm run preview`, not `npm run dev`.

## 4. Project layout (short)

```
src/            app code (App.jsx, ui.jsx, motion.js, i18n.js, App.css, logic/*)
public/sample/  organizer sample pack served as static files
tests/          node:test unit tests for the logic layer
docs/           this documentation
output/         package generated from the sample pack
screenshots/    evidence screenshots
.github/        GitHub Actions workflow (test -> build -> deploy)
```
See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture.

## 5. Deploy to GitHub Pages (what was done for the contest)

1. Create a **public** repository `devfest-<registration>` (here `devfest-241-15-223`) — empty, no README/licence.
2. `git remote add origin git@github.com:<user>/<repo>.git` and `git push -u origin main`.
3. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Every push to `main` runs `.github/workflows/deploy.yml`:
   `npm ci` → `npm test` → `npm run build` → upload `dist/` → deploy.
5. The site appears at `https://<user>.github.io/<repo>/` (here
   `https://rakibulx33.github.io/devfest-241-15-223/`). Check the run under the **Actions** tab; a green run means
   the new version is live (the CDN can take a few minutes to refresh; hard-reload with Ctrl+Shift+R).

Because `vite.config.js` uses `base: './'`, the same build also works from any other sub-path or from a plain
static file server.

## 6. Verifying a build

```bash
npm test && npm run lint && npm run build
npm run preview          # then open http://localhost:4173 and click through the sample pack
```

Expected sample-pack result: after matching the 8 required documents (use `trade_license_2026.pdf`, not 2025),
entering expiry dates (`2027-06-30` for the trade licence, `2026-12-31` for the bank letter) and generating, the
package has **17 pages** (cover + index + 15 document pages; 16 without the index) and every page ends with
`T-2026-0417 | Page X of 17`. The committed copy is `output/T-2026-0417_Package.pdf`.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page on GitHub Pages | *Settings → Pages → Source* must be **GitHub Actions**; check the Actions run is green |
| 404 for `assets/…` after deploy | Build was made with a different `base`; keep `base: './'` in `vite.config.js` |
| Old version still showing after a deploy | Cached by the CDN/browser: hard-reload (Ctrl+Shift+R) or wait ~10 minutes |
| `npm test` shows a footer assertion skipped | `pdftotext` is not installed — harmless; install `poppler-utils` to enable it |
| Fonts look different offline | Google Fonts could not load; the app falls back to system fonts and still works |
| Console error "violates Content Security Policy" in `npm run dev` | Expected only in dev (inline HMR scripts); use `npm run preview` |
| "This PDF is password-protected" | Remove the password in a PDF tool and upload again |
| Nothing is restored after reload | Browser storage is blocked (private window) — the app works but cannot save |
| Want a clean slate | Click **Start over** (clears saved work), or clear site data in Chrome |
