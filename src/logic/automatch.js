// Bonus: suggest file -> requirement matches from file names.
// Score = shared words between file name and title_en (prefix match, e.g. "cert" ~ "certificate").
// Generic words count half and never justify a match alone. When two different files tie for
// the best score on a requirement (e.g. trade_license_2025 vs _2026) nothing is suggested,
// so the user decides.
import { matchBlocker } from './status.js'

const GENERIC = new Set(['certificate', 'cert', 'letter', 'document', 'doc', 'copy', 'final', 'the', 'of', 'and'])
const words = (s) => s.toLowerCase().replace(/\.pdf$/, '').split(/[^a-z]+/).filter((w) => w.length >= 3)
const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))

export function scoreName(fileName, title) {
  let score = 0
  let strong = false
  for (const tw of words(title)) {
    if (!words(fileName).some((fw) => same(fw, tw))) continue
    const generic = GENERIC.has(tw)
    score += generic ? 0.5 : 1
    strong ||= !generic
  }
  return strong ? score : 0
}

export function suggestMatches(requirements, files, matches) {
  const result = { ...matches }
  const pairs = []
  for (const r of requirements) {
    if (result[r.id]) continue
    for (const f of files) {
      if (f.error) continue
      const s = scoreName(f.name, r.title_en)
      if (s > 0) pairs.push({ r, f, s })
    }
  }
  pairs.sort((a, b) => b.s - a.s || a.r.order - b.r.order || a.f.name.localeCompare(b.f.name))
  const ambiguous = new Set()
  for (const { r, f, s } of pairs) {
    if (result[r.id] || ambiguous.has(r.id) || matchBlocker(r.id, f.id, result, files)) continue
    // ambiguous: another file with different content scores the same for this requirement
    const rival = pairs.some((p) => p.r === r && p.f.hash !== f.hash && p.s === s && !matchBlocker(r.id, p.f.id, result, files))
    if (rival) {
      ambiguous.add(r.id)
      continue
    }
    result[r.id] = f.id
  }
  return result
}
