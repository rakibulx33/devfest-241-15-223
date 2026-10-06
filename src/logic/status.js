// Status rules (Problem Statement, Section 5). Dates are YYYY-MM-DD strings, so
// plain string comparison is a correct chronological comparison.
import { isIsoDate } from './requirements.js'

export const BLOCKING = new Set(['missing', 'expiry_needed', 'expired'])

export function statusOf(req, hasFile, expiry, deadline) {
  if (!hasFile) return req.mandatory ? 'missing' : 'not_provided'
  if (req.has_expiry) {
    if (!isIsoDate(expiry)) return 'expiry_needed'
    if (expiry < deadline) return 'expired' // same day as deadline is still OK
  }
  return 'ok'
}

export function allStatuses(requirements, matches, expiry, deadline) {
  return requirements.map((r) => ({ req: r, status: statusOf(r, !!matches[r.id], expiry[r.id], deadline) }))
}

// Ids of valid files whose content hash appears more than once.
export function duplicateIds(files) {
  const count = {}
  for (const f of files) if (!f.error) count[f.hash] = (count[f.hash] || 0) + 1
  return new Set(files.filter((f) => !f.error && count[f.hash] > 1).map((f) => f.id))
}

// Why a file cannot be matched to reqId (null = allowed).
// Rules: one file per document, one document per file, and files with identical
// content may not be matched to different documents.
export function matchBlocker(reqId, fileId, matches, files) {
  const file = files.find((f) => f.id === fileId)
  if (!file || file.error) return 'invalid'
  for (const [otherReq, otherFile] of Object.entries(matches)) {
    if (otherReq === reqId || !otherFile) continue
    if (otherFile === fileId) return 'used'
    const other = files.find((f) => f.id === otherFile)
    if (other && other.hash === file.hash) return 'duplicate'
  }
  return null
}
