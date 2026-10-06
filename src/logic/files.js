// Inspect one uploaded file: PDF check by content (magic bytes), SHA-256 hash, page count.
// Returns { hash, pages } or { error: 'not_pdf' | 'encrypted' | 'damaged' }. Never throws.
import { PDFDocument } from 'pdf-lib'

export const MAX_FILES = 30
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024

export function looksLikePdf(bytes) {
  // PDF header "%PDF-" must appear within the first 1024 bytes (PDF spec allows leading junk).
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

export async function sha256(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function inspectPdf(bytes) {
  const hash = await sha256(bytes)
  if (!looksLikePdf(bytes)) return { hash, error: 'not_pdf' }
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = doc.getPageCount()
    if (!pages) return { hash, error: 'damaged' }
    return { hash, pages }
  } catch (e) {
    return { hash, error: /encrypt/i.test(e?.message || '') ? 'encrypted' : 'damaged' }
  }
}
