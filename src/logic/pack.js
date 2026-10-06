// Build the final package PDF (Problem Statement, Section 6).
// Layout: cover (page 1) -> optional index page -> documents in requirement order.
// Footer "<tender_id> | Page X of Y" on every page. To never cover content, each
// document page gets an extra blank strip added BELOW its original area and the
// footer is drawn inside that strip.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

const A4 = [595.28, 841.89]
const STRIP = 28 // height of footer strip in points
const INK = rgb(0.1, 0.12, 0.16)
const MUTED = rgb(0.35, 0.38, 0.42)

// Standard PDF fonts only cover Latin-1; replace anything else so drawing never throws.
export const latin = (s) => String(s ?? '').replace(/[^\x20-\x7E -ÿ]/g, '?')

export const footerText = (tenderId, n, total) => `${latin(tenderId)} | Page ${n} of ${total}`

function fit(font, text, size, maxWidth) {
  let t = latin(text)
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxWidth) t = t.slice(0, -1)
  return t + '...'
}

function drawFooter(page, font, text, x0, y0, width) {
  page.drawRectangle({ x: x0, y: y0, width, height: STRIP, color: rgb(1, 1, 1) })
  page.drawLine({ start: { x: x0 + 24, y: y0 + STRIP - 2 }, end: { x: x0 + width - 24, y: y0 + STRIP - 2 }, thickness: 0.5, color: MUTED })
  const size = 10
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: x0 + (width - w) / 2, y: y0 + 9, size, font, color: INK })
}

// Add a footer strip under the page's visible area, keeping the original content untouched.
async function addFooterToDocPage(out, page, font, text) {
  const rot = (((page.getRotation().angle || 0) % 360) + 360) % 360
  const cb = page.getCropBox()
  if (rot === 0) {
    const mb = page.getMediaBox()
    const newBottom = cb.y - STRIP
    const mbBottom = Math.min(mb.y, newBottom)
    page.setMediaBox(mb.x, mbBottom, mb.width, mb.y + mb.height - mbBottom)
    page.setCropBox(cb.x, newBottom, cb.width, cb.height + STRIP)
    for (const box of ['TrimBox', 'BleedBox', 'ArtBox']) page.node.delete(page.node.context.obj(box))
    drawFooter(page, font, text, cb.x, newBottom, cb.width)
    return page
  }
  // Rotated page: draw it upright on a new page so "bottom" is the visual bottom.
  // ponytail: embedded pages lose links/form fields; fine for scanned/printed tender docs.
  // A blank page has no content stream and cannot be embedded; it has nothing to draw anyway.
  const emb = page.node.Contents()
    ? await out.embedPage(page, { left: cb.x, bottom: cb.y, right: cb.x + cb.width, top: cb.y + cb.height })
    : null
  const [w, h] = [cb.width, cb.height]
  const [vw, vh] = rot % 180 ? [h, w] : [w, h]
  const np = out.addPage([vw, vh + STRIP])
  const pos = { 90: [0, STRIP + vh], 180: [vw, STRIP + vh], 270: [vw, STRIP] }[rot]
  if (emb) np.drawPage(emb, { x: pos[0], y: pos[1], width: w, height: h, rotate: degrees(-rot) })
  drawFooter(np, font, text, 0, 0, vw)
  return np
}

/**
 * @param tender  tender object from requirements.json
 * @param docs    [{ order, title_en, fileName, bytes }] already sorted by order
 * @param generatedDate 'YYYY-MM-DD'
 * @param withIndex add index page after the cover (bonus)
 * @returns Uint8Array
 */
export async function buildPackage({ tender, docs, generatedDate, withIndex = false }) {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)

  const sources = []
  for (const d of docs) sources.push(await PDFDocument.load(d.bytes, { updateMetadata: false }))
  const front = withIndex ? 2 : 1
  const counts = sources.map((s) => s.getPageCount())
  const total = front + counts.reduce((a, b) => a + b, 0)
  const starts = []
  counts.reduce((p, c, i) => ((starts[i] = p), p + c), front + 1)

  // ---- Cover page (English) ----
  const cover = out.addPage(A4)
  const W = A4[0]
  let y = A4[1] - 72
  const L = 56
  cover.drawText('TENDER SUBMISSION PACKAGE', { x: L, y, size: 20, font: bold, color: INK })
  y -= 14
  cover.drawLine({ start: { x: L, y }, end: { x: W - L, y }, thickness: 1.5, color: INK })
  y -= 30
  const rows = [
    ['Tender ID', tender.tender_id],
    ['Tender Title', tender.title],
    ['Procuring Entity', tender.procuring_entity],
    ['Bidder', tender.bidder],
    ['Submission Deadline', tender.submission_deadline],
    ['Package Generated', generatedDate],
  ]
  for (const [k, v] of rows) {
    cover.drawText(k, { x: L, y, size: 11, font: bold, color: MUTED })
    cover.drawText(fit(font, v, 12, W - L - 190), { x: L + 140, y, size: 12, font, color: INK })
    y -= 22
  }
  y -= 16
  cover.drawText('Included Documents', { x: L, y, size: 14, font: bold, color: INK })
  y -= 22
  const lineH = docs.length > 20 ? 15 : 19
  docs.forEach((d, i) => {
    const pages = `${counts[i]} page${counts[i] > 1 ? 's' : ''}`
    cover.drawText(`${i + 1}.`, { x: L, y, size: 11, font: bold, color: INK })
    cover.drawText(fit(font, d.title_en, 11, W - L * 2 - 110), { x: L + 24, y, size: 11, font, color: INK })
    const pw = font.widthOfTextAtSize(pages, 10)
    cover.drawText(pages, { x: W - L - pw, y, size: 10, font, color: MUTED })
    y -= lineH
  })
  drawFooter(cover, font, footerText(tender.tender_id, 1, total), 0, 0, W)

  // ---- Index page (bonus) ----
  if (withIndex) {
    const idx = out.addPage(A4)
    let iy = A4[1] - 72
    idx.drawText('INDEX', { x: L, y: iy, size: 20, font: bold, color: INK })
    iy -= 14
    idx.drawLine({ start: { x: L, y: iy }, end: { x: W - L, y: iy }, thickness: 1.5, color: INK })
    iy -= 28
    idx.drawText('Document', { x: L + 24, y: iy, size: 10, font: bold, color: MUTED })
    idx.drawText('Starts on page', { x: W - L - bold.widthOfTextAtSize('Starts on page', 10), y: iy, size: 10, font: bold, color: MUTED })
    iy -= 20
    docs.forEach((d, i) => {
      idx.drawText(`${i + 1}.`, { x: L, y: iy, size: 11, font: bold, color: INK })
      idx.drawText(fit(font, d.title_en, 11, W - L * 2 - 100), { x: L + 24, y: iy, size: 11, font, color: INK })
      const p = String(starts[i])
      idx.drawText(p, { x: W - L - bold.widthOfTextAtSize(p, 11), y: iy, size: 11, font: bold, color: INK })
      iy -= lineH
    })
    drawFooter(idx, font, footerText(tender.tender_id, 2, total), 0, 0, W)
  }

  // ---- Documents, all pages in original order ----
  let n = front
  for (const src of sources) {
    const copied = await out.copyPages(src, src.getPageIndices())
    for (const p of copied) {
      n++
      const rot = (((p.getRotation().angle || 0) % 360) + 360) % 360
      if (rot === 0) {
        out.addPage(p)
        await addFooterToDocPage(out, p, font, footerText(tender.tender_id, n, total))
      } else {
        await addFooterToDocPage(out, p, font, footerText(tender.tender_id, n, total))
      }
    }
  }
  out.setTitle(`${latin(tender.tender_id)} Package`)
  return out.save()
}
