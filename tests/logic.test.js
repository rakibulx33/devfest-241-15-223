import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PDFDocument, degrees } from 'pdf-lib'
import { parseRequirements, isIsoDate } from '../src/logic/requirements.js'
import { statusOf, BLOCKING, duplicateIds, matchBlocker } from '../src/logic/status.js'
import { inspectPdf } from '../src/logic/files.js'
import { buildPackage, footerText } from '../src/logic/pack.js'

const S = new URL('../public/sample/', import.meta.url)
const read = (p) => new Uint8Array(readFileSync(new URL(p, S)))
const sample = parseRequirements(readFileSync(new URL('requirements.json', S), 'utf8'))
const DL = '2026-10-20'

test('sample requirements parse and sort by order', () => {
  assert.ok(!sample.errors)
  assert.equal(sample.requirements.length, 10)
  assert.deepEqual(sample.requirements.map((r) => r.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('requirements sorted by order even if shuffled; ties by id', () => {
  const r = (id, order) => ({ id, order, title_en: id, title_bn: id, mandatory: true, has_expiry: false })
  const t = { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: DL }
  const res = parseRequirements(JSON.stringify({ tender: t, requirements: [r('C', 3), r('B', 1), r('A', 1)] }))
  assert.deepEqual(res.requirements.map((x) => x.id), ['A', 'B', 'C'])
})

test('invalid requirements are rejected with reasons', () => {
  assert.ok(parseRequirements('{oops').errors)
  assert.ok(parseRequirements('{}').errors.length >= 2)
  const bad = { tender: { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: '2026-02-30' }, requirements: [{ id: 'R1' }] }
  const e = parseRequirements(JSON.stringify(bad)).errors
  assert.ok(e.some((m) => m.includes('submission_deadline')))
  assert.ok(e.some((m) => m.includes('mandatory')))
  assert.equal(isIsoDate('2026-10-20'), true)
  assert.equal(isIsoDate('20-10-2026'), false)
})

test('status rules (Section 5)', () => {
  const mand = { mandatory: true, has_expiry: false }
  const mandExp = { mandatory: true, has_expiry: true }
  const opt = { mandatory: false, has_expiry: false }
  const optExp = { mandatory: false, has_expiry: true }
  assert.equal(statusOf(mand, false, '', DL), 'missing')
  assert.equal(statusOf(mandExp, false, '', DL), 'missing')
  assert.equal(statusOf(opt, false, '', DL), 'not_provided')
  assert.equal(statusOf(optExp, false, '2020-01-01', DL), 'not_provided')
  assert.equal(statusOf(mand, true, '', DL), 'ok')
  assert.equal(statusOf(mandExp, true, '', DL), 'expiry_needed')
  assert.equal(statusOf(mandExp, true, '2025-06-30', DL), 'expired')
  assert.equal(statusOf(mandExp, true, '2026-10-19', DL), 'expired')
  assert.equal(statusOf(mandExp, true, DL, DL), 'ok') // same day = OK
  assert.equal(statusOf(mandExp, true, '2027-06-30', DL), 'ok')
  assert.equal(statusOf(optExp, true, '2026-01-01', DL), 'expired')
  assert.ok(BLOCKING.has('missing') && BLOCKING.has('expiry_needed') && BLOCKING.has('expired'))
  assert.ok(!BLOCKING.has('not_provided') && !BLOCKING.has('ok'))
})

test('file inspection: non-PDF, duplicates, page counts, damaged', async () => {
  const png = await inspectPdf(read('documents/company_logo.png'))
  assert.equal(png.error, 'not_pdf')
  const a = await inspectPdf(read('documents/experience_cert.pdf'))
  const b = await inspectPdf(read('documents/experience_cert (1).pdf'))
  assert.equal(a.pages, 2)
  assert.equal(a.hash, b.hash)
  assert.equal((await inspectPdf(read('documents/02_technical_proposal.pdf'))).pages, 6)
  const broken = new TextEncoder().encode('%PDF-1.4\n garbage garbage')
  assert.ok(['damaged'].includes((await inspectPdf(broken)).error))
})

test('matching: 1:1 and duplicate content blocked across documents', () => {
  const files = [
    { id: 'f1', hash: 'h1' }, { id: 'f2', hash: 'h1' }, { id: 'f3', hash: 'h3' }, { id: 'f4', hash: 'h4', error: 'not_pdf' },
  ]
  assert.deepEqual([...duplicateIds(files)].sort(), ['f1', 'f2'])
  const matches = { R05: 'f1' }
  assert.equal(matchBlocker('R02', 'f1', matches, files), 'used')
  assert.equal(matchBlocker('R02', 'f2', matches, files), 'duplicate')
  assert.equal(matchBlocker('R05', 'f2', matches, files), null) // swap within same doc is fine
  assert.equal(matchBlocker('R02', 'f3', matches, files), null)
  assert.equal(matchBlocker('R02', 'f4', matches, files), 'invalid')
})

test('package: cover + docs in order, footer on every page, sample = 16 pages', async () => {
  const pick = { R01: 'trade_license_2026.pdf', R02: '03_tin_certificate.pdf', R03: '04_vat_certificate.pdf', R04: 'bank_solvency.pdf', R05: 'experience_cert.pdf', R08: '02_technical_proposal.pdf', R09: '01_financial_proposal.pdf', R10: 'scan_0042.pdf' }
  const docs = sample.requirements.filter((r) => pick[r.id]).map((r) => ({ title_en: r.title_en, bytes: read('documents/' + pick[r.id]) }))
  const bytes = await buildPackage({ tender: sample.tender, docs, generatedDate: '2026-10-06' })
  const out = await PDFDocument.load(bytes)
  assert.equal(out.getPageCount(), 16)
  // Footer must sit below the original content area (page taller than A4 by strip).
  assert.ok(out.getPage(1).getHeight() > 841.89)
  let text = ''
  try {
    const tmp = new URL('../node_modules/.pkg-test.pdf', import.meta.url)
    const { writeFileSync } = await import('node:fs')
    writeFileSync(tmp, bytes)
    text = execFileSync('pdftotext', ['-layout', fileURLToPath(tmp), '-'], { encoding: 'utf8' })
  } catch { /* pdftotext not installed (CI): skip text checks */ }
  if (text) {
    const pages = text.split('\f')
    assert.ok(pages[0].includes('T-2026-0417 | Page 1 of 16'))
    assert.ok(pages[15].includes('T-2026-0417 | Page 16 of 16'))
    assert.ok(pages[1].includes('TRADE LICENSE') && pages[1].includes('2026-2027'))
    assert.ok(pages[7].includes('Technical Proposal') && pages[13].includes('Financial Proposal'))
  }
  const withIdx = await PDFDocument.load(await buildPackage({ tender: sample.tender, docs, generatedDate: '2026-10-06', withIndex: true }))
  assert.equal(withIdx.getPageCount(), 17)
})

test('rotated pages get footer at visual bottom without crashing', async () => {
  const d = await PDFDocument.create()
  const p1 = d.addPage([600, 400]); p1.drawText('rotated 90'); p1.setRotation(degrees(90))
  d.addPage([600, 400]).setRotation(degrees(270)) // blank page, no content stream
  const src = await d.save()
  const out = await PDFDocument.load(await buildPackage({ tender: sample.tender, docs: [{ title_en: 'Rot', bytes: src }], generatedDate: '2026-10-06' }))
  assert.equal(out.getPageCount(), 3)
  assert.equal(out.getPage(1).getWidth(), 400)
  assert.equal(footerText('T-1', 2, 3), 'T-1 | Page 2 of 3')
})

test('auto-match suggests by file name, skips ambiguous ties', async () => {
  const { suggestMatches } = await import('../src/logic/automatch.js')
  const names = ['01_financial_proposal.pdf', '02_technical_proposal.pdf', '03_tin_certificate.pdf', '04_vat_certificate.pdf', 'bank_solvency.pdf', 'experience_cert (1).pdf', 'experience_cert.pdf', 'scan_0042.pdf', 'trade_license_2025.pdf', 'trade_license_2026.pdf']
  const files = await Promise.all(names.map(async (name, i) => ({ id: 'f' + i, name, ...(await inspectPdf(read('documents/' + name))) })))
  const m = suggestMatches(sample.requirements, files, {})
  const nameOf = (id) => files.find((f) => f.id === id)?.name
  assert.equal(nameOf(m.R02), '03_tin_certificate.pdf')
  assert.equal(nameOf(m.R03), '04_vat_certificate.pdf')
  assert.equal(nameOf(m.R04), 'bank_solvency.pdf')
  assert.match(nameOf(m.R05), /experience_cert/)
  assert.equal(nameOf(m.R08), '02_technical_proposal.pdf')
  assert.equal(nameOf(m.R09), '01_financial_proposal.pdf')
  assert.equal(m.R01, undefined) // 2025 vs 2026 tie -> user decides
  assert.equal(m.R06, undefined)
})

test('page list parsing for seal placement', async () => {
  const { parsePageList } = await import('../src/logic/pack.js')
  assert.deepEqual(parsePageList('3, 5-7', 10), [3, 5, 6, 7])
  assert.deepEqual(parsePageList('2,2,1', 10), [1, 2])
  assert.equal(parsePageList('0', 10), null)
  assert.equal(parsePageList('5-3', 10), null)
  assert.equal(parsePageList('11', 10), null)
  assert.equal(parsePageList('abc', 10), null)
  assert.equal(parsePageList('', 10), null)
})

test('seal image is placed without changing page count', async () => {
  const png = read('documents/company_logo.png')
  const docs = [{ title_en: 'TIN', bytes: read('documents/03_tin_certificate.pdf') }]
  const out = await PDFDocument.load(await buildPackage({ tender: sample.tender, docs, generatedDate: '2026-10-06', seal: { bytes: png, pages: [2], position: 'right' } }))
  assert.equal(out.getPageCount(), 2)
})
