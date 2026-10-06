import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { BrandMark, Dossier, Icon, LangSwitch, Step, StatusStamp, reducedMotion, useRipple } from './ui.jsx'
import { t as tr } from './i18n.js'
import { parseRequirements } from './logic/requirements.js'
import { allStatuses, BLOCKING, duplicateIds, matchBlocker } from './logic/status.js'
import { inspectPdf, MAX_FILES, MAX_TOTAL_BYTES } from './logic/files.js'
import { buildPackage, parsePageList } from './logic/pack.js'
import { suggestMatches } from './logic/automatch.js'
import { loadProject, saveProject, clearProject } from './logic/saved.js'

const SAMPLE_DOCS = [
  '01_financial_proposal.pdf', '02_technical_proposal.pdf', '03_tin_certificate.pdf', '04_vat_certificate.pdf',
  'bank_solvency.pdf', 'company_logo.png', 'experience_cert (1).pdf', 'experience_cert.pdf', 'scan_0042.pdf',
  'trade_license_2025.pdf', 'trade_license_2026.pdf',
]
const MAX_MB = MAX_TOTAL_BYTES / 1024 / 1024
let nextId = 1

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } },
}
const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
// Render Bangla text to a PNG with the browser's text engine (pdf-lib cannot shape Bangla).
// Drawn at 4x for print sharpness; w/h are returned in PDF points.
async function bnPng(text) {
  try {
    await document.fonts.load('48px "Noto Sans Bengali"')
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    const font = '48px "Noto Sans Bengali", sans-serif'
    ctx.font = font
    c.width = Math.ceil(ctx.measureText(text).width) + 8
    c.height = 72
    ctx.font = font
    ctx.fillStyle = '#1a1f29'
    ctx.fillText(text, 4, 52)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width / 4, h: c.height / 4 }
  } catch {
    return null // no Bangla on the index; English stays
  }
}
const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

export default function App() {
  const [lang, setLang] = useState(() => (store.get('lang') === 'bn' ? 'bn' : 'en'))
  const t = (k, v) => tr(lang, k, v)
  const [req, setReq] = useState(null)
  const [reqErrors, setReqErrors] = useState([])
  const [files, setFiles] = useState([])
  const [matches, setMatches] = useState({})
  const [expiry, setExpiry] = useState({})
  const [reading, setReading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [withIndex, setWithIndex] = useState(true)
  const [gen, setGen] = useState({ state: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const [seal, setSeal] = useState(null) // { bytes, name } | { error }
  const [sealMode, setSealMode] = useState('last')
  const [sealPages, setSealPages] = useState('')
  const [sealPos, setSealPos] = useState('right')
  const sealInput = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [flash, setFlash] = useState(null) // row briefly highlighted after a jump
  const [leaving, setLeaving] = useState(null) // file row fading out before removal
  const [swap, setSwap] = useState(false) // brief crossfade when the language changes
  const [shaking, setShaking] = useState(false)
  useRipple()
  const [sealOpen, setSealOpen] = useState(false)
  const [restored, setRestored] = useState(false)
  const jsonInput = useRef(null)

  // Bonus: restore saved work once, then auto-save every change (IndexedDB, this browser only).
  useEffect(() => {
    loadProject().then((p) => {
      if (p?.req) {
        setReq(p.req)
        setFiles(p.files || [])
        setMatches(p.matches || {})
        setExpiry(p.expiry || {})
        setWithIndex(p.withIndex ?? true)
        nextId = 1 + Math.max(0, ...(p.files || []).map((f) => +f.id.slice(1) || 0))
        setRestored(true)
      }
      setLoaded(true)
    })
  }, [])
  useEffect(() => {
    if (loaded) saveProject({ req, files, matches, expiry, withIndex })
  }, [loaded, req, files, matches, expiry, withIndex])
  function startOver() {
    clearProject()
    setReq(null); setReqErrors([]); setFiles([]); setMatches({}); setExpiry({}); setNotice(null); setRestored(false); resetGen()
  }
  const pdfInput = useRef(null)

  const changeLang = (next) => {
    if (next === lang) return
    store.set('lang', next)
    setLang(next)
    setSwap(true)
    setTimeout(() => setSwap(false), 350)
  }
  const title = (r) => (lang === 'bn' ? r.title_bn : r.title_en)
  const resetGen = () => setGen({ state: 'idle' })

  // ---------- Step 1: requirements ----------
  function applyRequirements(text) {
    const res = parseRequirements(text)
    resetGen()
    if (res.errors) {
      setReqErrors(res.errors)
      setReq(null)
      return
    }
    setReqErrors([])
    setReq(res)
    setMatches({})
    setExpiry({})
  }
  async function onJsonFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    applyRequirements(await f.text())
  }
  async function loadSample() {
    const res = await fetch('./sample/requirements.json')
    applyRequirements(await res.text())
  }

  // ---------- Step 2: files ----------
  async function addFiles(list) {
    if (!list.length) return
    setReading(true)
    resetGen()
    const added = []
    let count = files.filter((f) => !f.error).length
    let total = files.filter((f) => !f.error).reduce((a, f) => a + f.size, 0)
    for (const file of list) {
      const base = { id: 'f' + nextId++, name: file.name, size: file.size }
      if (count + 1 > MAX_FILES) { added.push({ ...base, error: 'too_many' }); continue }
      if (total + file.size > MAX_TOTAL_BYTES) { added.push({ ...base, error: 'too_big' }); continue }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const info = await inspectPdf(bytes)
      if (!info.error) { count++; total += file.size }
      added.push({ ...base, ...info, bytes: info.error ? null : bytes })
    }
    setFiles((prev) => [...prev, ...added])
    setReading(false)
  }
  async function loadSampleDocs() {
    const list = await Promise.all(
      SAMPLE_DOCS.map(async (n) => new File([await (await fetch('./sample/documents/' + encodeURIComponent(n))).blob()], n)),
    )
    addFiles(list)
  }
  function removeFile(id) {
    resetGen()
    setLeaving(id)
    const freed = Object.keys(matches).filter((r) => matches[r] === id)
    setTimeout(() => {
      setLeaving(null)
      setFiles((prev) => prev.filter((f) => f.id !== id))
      setMatches((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id)))
      setExpiry((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !freed.includes(k))))
    }, reducedMotion() ? 0 : 220)
  }

  // ---------- Step 3: matching ----------
  function setMatch(reqId, fileId) {
    resetGen()
    if (fileId && matchBlocker(reqId, fileId, matches, files)) return
    setMatches((m) => {
      const next = { ...m }
      if (fileId) next[reqId] = fileId
      else delete next[reqId]
      return next
    })
    setExpiry((x) => { const n = { ...x }; delete n[reqId]; return n }) // date belonged to the old file
  }
  function autoMatch() {
    resetGen()
    const next = suggestMatches(req.requirements, files, matches)
    const n = Object.keys(next).length - Object.keys(matches).length
    setMatches(next)
    setNotice(n > 0 ? { key: 'autoMatchDone', n } : { key: 'autoMatchNone' })
  }
  function clearMatches() {
    resetGen()
    setMatches({})
    setExpiry({})
    setNotice(null)
  }

  const dups = useMemo(() => duplicateIds(files), [files])
  const fileById = useMemo(() => Object.fromEntries(files.map((f) => [f.id, f])), [files])
  const rows = useMemo(
    () => (req ? allStatuses(req.requirements, matches, expiry, req.tender.submission_deadline) : []),
    [req, matches, expiry],
  )
  const blocking = rows.filter((r) => BLOCKING.has(r.status))
  const included = rows.filter((r) => matches[r.req.id])
  const totalPages = (withIndex ? 2 : 1) + included.reduce((a, r) => a + (fileById[matches[r.req.id]]?.pages || 0), 0)
  // Package page numbers for the seal (bonus)
  const sealUrl = useMemo(() => (seal?.bytes ? URL.createObjectURL(new Blob([seal.bytes], { type: 'image/png' })) : null), [seal])
  const sealPageList = useMemo(() => {
    if (!seal?.bytes) return []
    if (sealMode === 'custom') return parsePageList(sealPages, totalPages)
    const list = []
    let p = withIndex ? 2 : 1
    for (const r of included) {
      const n = fileById[matches[r.req.id]]?.pages || 0
      if (sealMode === 'all') for (let i = 1; i <= n; i++) list.push(p + i)
      else if (n) list.push(p + n)
      p += n
    }
    return list
  }, [seal, sealMode, sealPages, totalPages, withIndex, included, fileById, matches])
  const sealInvalid = !!seal?.bytes && sealMode === 'custom' && !sealPageList
  async function onSealFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    resetGen()
    const bytes = new Uint8Array(await f.arrayBuffer())
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    setSeal(isPng ? { bytes, name: f.name } : { error: true, name: f.name })
  }
  const reqOfFile = (fid) => req?.requirements.find((r) => matches[r.id] === fid)
  const packageName = req ? `${req.tender.tender_id}_Package.pdf` : ''

  // ---------- Step 4: generate ----------
  async function generate() {
    if (!req || blocking.length || sealInvalid) return
    setGen({ state: 'busy' })
    try {
      const docs = []
      for (const r of included) {
        docs.push({
          title_en: r.req.title_en,
          bytes: fileById[matches[r.req.id]].bytes,
          bnPng: withIndex ? await bnPng(r.req.title_bn) : null,
        })
      }
      const sealOpt = seal?.bytes ? { bytes: seal.bytes, pages: sealPageList, position: sealPos } : null
      const bytes = await buildPackage({ tender: req.tender, docs, generatedDate: today(), withIndex, seal: sealOpt })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      setGen({ state: 'done', url, pages: totalPages })
      const a = document.createElement('a')
      a.href = url
      a.download = packageName
      a.click()
    } catch (e) {
      setGen({ state: 'error', msg: e?.message || String(e) })
    }
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = [t('colOrder'), t('colDoc'), t('colFile'), t('csvPages'), t('colExpiry'), t('colStatus')]
    const lines = rows.map(({ req: r, status }) => {
      const f = fileById[matches[r.id]]
      return [r.order, title(r), f?.name || '', f?.pages || '', expiry[r.id] || '', t('st_' + status)]
    })
    const csv = '﻿' + [head, ...lines].map((l) => l.map(esc).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `${req.tender.tender_id}_Checklist.csv`
    a.click()
  }

  const pagesLabel = (n) => (n === 1 ? t('page1') : t('pages', { n }))
  const canGenerate = !!req && blocking.length === 0 && !sealInvalid && gen.state !== 'busy'
  const steps = {
    1: !!req,
    2: files.some((f) => !f.error),
    3: !!req && blocking.length === 0 && included.length > 0,
    4: gen.state === 'done',
  }

  // Scroll to a document row, highlight it and focus its first control (used by the package panel).
  function jumpTo(id) {
    const row = document.getElementById('row-' + id)
    if (!row) return
    const calm = reducedMotion()
    row.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
    setFlash(id)
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600)
    setTimeout(() => row.querySelector('select, input')?.focus({ preventScroll: true }), calm ? 0 : 350)
  }

  // Pressing Generate while blocked: shake the package and take the user to the first problem.
  function tryGenerate() {
    if (canGenerate) return generate()
    if (req && blocking.length) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      jumpTo(blocking[0].req.id)
    } else if (sealInvalid) setSealOpen(true)
  }

  return (
    <div className={'app' + (swap ? ' swap' : '')} lang={lang}>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <BrandMark />
            <div>
              <h1>{t('appTitle')}</h1>
              <p className="sub">{t('appSub')}</p>
            </div>
          </div>
          <LangSwitch lang={lang} onChange={changeLang} label={t('langLabel')} />
        </div>
      </header>

      <div className="workspace">
        <main className="flow">
          {restored && (
            <div className="alert ok restored" role="status">
              <Icon name="check" size={18} />
              <span>{t('restored')}</span>
              <button className="btn small" onClick={startOver}>{t('startOver')}</button>
            </div>
          )}

          {/* Step 1: tender requirements */}
          <Step n={1} id="s1" done={steps[1]} title={t('step1')} help={!req ? t('step1Help') : null} t={t}>
            <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={onJsonFile} />
            {reqErrors.length > 0 && (
              <div className="alert error" role="alert">
                <Icon name="x" size={18} />
                <div>
                  <strong>{t('jsonErrorTitle')}</strong>
                  <ul>{reqErrors.map((e, i) => <li key={i}>{t('rq_' + e.code, { ...e, field: e.field })}</li>)}</ul>
                </div>
              </div>
            )}
            {!req ? (
              <div className="actions">
                <button className="btn primary" onClick={() => jsonInput.current.click()}><Icon name="upload" size={18} />{t('openJson')}</button>
                <button className="btn" onClick={loadSample}>{t('loadSample')}</button>
                {files.length > 0 && <button className="btn ghost" onClick={startOver}><Icon name="reset" size={16} />{t('startOver')}</button>}
              </div>
            ) : (
              <div className="tender-band">
                <div className="tb-head">
                  <span className="tb-id">{req.tender.tender_id}</span>
                  <span className="tb-deadline"><Icon name="calendar" size={16} />{t('deadline')}: <b>{req.tender.submission_deadline}</b></span>
                </div>
                <p className="tb-title">{req.tender.title}</p>
                <dl className="tb-meta">
                  <div><dt>{t('entity')}</dt><dd>{req.tender.procuring_entity}</dd></div>
                  <div><dt>{t('bidder')}</dt><dd>{req.tender.bidder}</dd></div>
                </dl>
                <div className="actions">
                  <button className="btn small" onClick={() => jsonInput.current.click()}>{t('openAnother')}</button>
                  <button className="btn ghost small" onClick={startOver}><Icon name="reset" size={15} />{t('startOver')}</button>
                </div>
              </div>
            )}
          </Step>

          {/* Step 2: upload */}
          <Step n={2} id="s2" done={steps[2]} title={t('step2')} help={t('step2Help', { maxFiles: MAX_FILES, maxMb: MAX_MB })} t={t}>
            <div
              className={'drop' + (dragOver ? ' over' : '') + (files.length === 0 ? ' idle' : '')}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles([...e.dataTransfer.files]) }}
            >
              <Icon name="upload" size={30} className="drop-ico" />
              <div className="drop-text">
                <strong>{t('dropTitle')}</strong>
                <span>{t('dropSub')}</span>
              </div>
              <div className="drop-actions">
                <button className="btn primary" onClick={() => pdfInput.current.click()}>{t('chooseFiles')}</button>
                <button className="btn" onClick={loadSampleDocs}>{t('loadSampleDocs')}</button>
              </div>
              <input ref={pdfInput} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />
            </div>
            {reading && <p className="muted reading" role="status"><span className="spin dark" aria-hidden="true" />{t('reading')}</p>}
            {files.length === 0 ? (
              <p className="empty">{t('noFiles')}</p>
            ) : (
              <ul className="files">
                {files.map((f, i) => {
                  const used = reqOfFile(f.id)
                  const twins = files.filter((o) => o.id !== f.id && !o.error && o.hash === f.hash)
                  return (
                    <li key={f.id} style={{ '--i': Math.min(i, 10) }} className={'file ' + (f.error ? 'bad' : dups.has(f.id) ? 'dup' : '') + (leaving === f.id ? ' leaving' : '')}>
                      <span className="pdf-ico" aria-hidden="true">
                        <Icon name={f.error ? 'x' : 'file'} size={22} />
                        {!f.error && <b>{f.pages}</b>}
                      </span>
                      <div className="fbody">
                        <div className="fname">{f.name}</div>
                        <div className="fmeta">{f.error ? kb(f.size) : `${pagesLabel(f.pages)} · ${kb(f.size)}`}</div>
                        <div className="ftags">
                          {f.error && <span className="tag t-bad"><Icon name="x" size={13} />{t('err_' + f.error, { maxFiles: MAX_FILES, maxMb: MAX_MB })}</span>}
                          {!f.error && dups.has(f.id) && (
                            <span className="tag t-dup"><Icon name="copy" size={13} />{t('dupBadge')} — {t('dupOf', { names: twins.map((o) => o.name).join(', ') })}</span>
                          )}
                          {!f.error && (used
                            ? <span className="tag t-ok"><Icon name="check" size={13} />{t('matchedTo', { doc: title(used) })}</span>
                            : <span className="tag t-idle">{t('notMatched')}</span>)}
                        </div>
                      </div>
                      <button className="icon-btn" onClick={() => removeFile(f.id)} aria-label={t('removeLabel', { name: f.name })} title={t('remove')}>
                        <Icon name="trash" size={18} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Step>

          {/* Step 3: match + check */}
          <Step n={3} id="s3" done={steps[3]} title={t('step3')} help={req ? t('step3Help') : null} t={t}>
            {!req ? (
              <div className="empty-state">
                <Icon name="file" size={28} />
                <p>{t('loadFirst')}</p>
                <button className="btn" onClick={() => jsonInput.current.click()}>{t('openJson')}</button>
              </div>
            ) : (
              <>
                <div className="toolbar">
                  <button className="btn" onClick={autoMatch} disabled={!files.some((f) => !f.error)}>{t('autoMatch')}</button>
                  <button className="btn ghost" onClick={clearMatches} disabled={!Object.keys(matches).length}>{t('clearMatches')}</button>
                  {notice && <span className="notice" role="status"><Icon name="check" size={15} />{t(notice.key, notice)}</span>}
                </div>
                <div className="ledger">
                  <table className="reqs">
                    <caption className="sr">{t('tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('colOrder')}</th>
                        <th scope="col">{t('colDoc')}</th>
                        <th scope="col">{t('colFileExpiry')}</th>
                        <th scope="col">{t('colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ req: r, status }, i) => {
                        const selId = 'sel-' + r.id
                        return (
                          <tr key={r.id} id={'row-' + r.id} style={{ '--i': Math.min(i, 12) }} className={'row-' + status + (flash === r.id ? ' flash' : '')}>
                            <td data-label={t('colOrder')} className="ord"><span>{r.order}</span></td>
                            <td data-label={t('colDoc')}>
                              <div className="dname">{title(r)}</div>
                              <div className="dtags">
                                <span className={'chip ' + (r.mandatory ? 'c-req' : 'c-opt')}>{r.mandatory ? t('mandatory') : t('optional')}</span>
                                {r.has_expiry && <span className="chip c-exp"><Icon name="calendar" size={12} />{t('hasExpiry')}</span>}
                              </div>
                            </td>
                            <td data-label={t('colFileExpiry')}>
                              <label className="sr" htmlFor={selId}>{t('colFile')} — {title(r)}</label>
                              <select id={selId} value={matches[r.id] || ''} onChange={(e) => setMatch(r.id, e.target.value)}>
                                <option value="">{t('noFileOption')}</option>
                                {files.filter((f) => !f.error).map((f) => {
                                  const why = matchBlocker(r.id, f.id, matches, files)
                                  const other = why === 'used' ? reqOfFile(f.id) : null
                                  const suffix = why === 'used' ? ' ' + t('optUsed', { doc: title(other) }) : why === 'duplicate' ? ' ' + t('optDup') : ''
                                  return (
                                    <option key={f.id} value={f.id} disabled={!!why}>
                                      {f.name} ({pagesLabel(f.pages)}){suffix}
                                    </option>
                                  )
                                })}
                              </select>
                              {r.has_expiry && (
                                matches[r.id] ? (
                                  <label className="exp-field">
                                    <span>{t('colExpiry')}</span>
                                    <input
                                      type="date"
                                      value={expiry[r.id] || ''}
                                      onChange={(e) => { resetGen(); setExpiry((x) => ({ ...x, [r.id]: e.target.value })) }}
                                    />
                                  </label>
                                ) : (
                                  <div className="muted exp-wait">{t('pickFileFirst')}</div>
                                )
                              )}
                            </td>
                            <td data-label={t('colStatus')}>
                              <StatusStamp key={status} status={status} label={t('st_' + status)} />
                              <div className="hint">{t('hint_' + status, { deadline: req.tender.submission_deadline })}</div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Step>

          {/* Step 4: options */}
          <Step n={4} id="s4" done={steps[4]} title={t('step4')} help={t('step4Help')} last t={t}>
            <label className="switch">
              <input type="checkbox" role="switch" checked={withIndex} onChange={(e) => { resetGen(); setWithIndex(e.target.checked) }} />
              <span className="track" aria-hidden="true"><span className="thumb" /></span>
              <span>{t('withIndex')}</span>
            </label>
            <details className="opt" open={sealOpen} onToggle={(e) => setSealOpen(e.currentTarget.open)}>
              <summary>
                <span>{t('sealTitle')}</span>
                <Icon name="chevron" size={16} className="caret" />
              </summary>
              <div className="opt-body">
                <p className="help">{t('sealHelp')}</p>
                <div className="actions">
                  <button className="btn" onClick={() => sealInput.current.click()}>{t('sealChoose')}</button>
                  <input ref={sealInput} type="file" accept="image/png" hidden onChange={onSealFile} />
                  {seal && (
                    <>
                      {sealUrl && <img className="seal-prev" src={sealUrl} alt={t('sealPreview')} />}
                      <span className="muted">{seal.name}</span>
                      <button className="btn small" onClick={() => { resetGen(); setSeal(null) }}>{t('sealRemove')}</button>
                    </>
                  )}
                </div>
                {seal?.error && <div className="alert error" role="alert"><Icon name="x" size={18} /><span>{t('sealBadPng')}</span></div>}
                {seal?.bytes && (
                  <div className="seal-opts">
                    <div role="radiogroup" aria-label={t('sealWhere')}>
                      <strong>{t('sealWhere')}</strong>
                      {['last', 'all', 'custom'].map((m) => (
                        <label key={m} className="check">
                          <input type="radio" name="sealMode" checked={sealMode === m} onChange={() => { resetGen(); setSealMode(m) }} />
                          {t('seal_' + m)}
                        </label>
                      ))}
                      {sealMode === 'custom' && (
                        <input
                          className="pages-in"
                          type="text"
                          inputMode="numeric"
                          placeholder="3, 5-7"
                          aria-label={t('sealPagesLabel')}
                          aria-invalid={sealInvalid}
                          value={sealPages}
                          onChange={(e) => { resetGen(); setSealPages(e.target.value) }}
                        />
                      )}
                      {sealInvalid && <div className="alert error" role="alert"><Icon name="x" size={18} /><span>{t('sealPagesBad', { total: totalPages })}</span></div>}
                    </div>
                    <label className="pos">
                      <strong>{t('sealPos')}</strong>
                      <select value={sealPos} onChange={(e) => { resetGen(); setSealPos(e.target.value) }}>
                        <option value="right">{t('sealRight')}</option>
                        <option value="left">{t('sealLeft')}</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </details>
            <div className="inline-gen only-desktop">
              <button className={'btn primary big' + (canGenerate ? '' : ' is-off') + (gen.state === 'busy' ? ' busy' : '')} onClick={tryGenerate} aria-disabled={!canGenerate}>
                {gen.state === 'busy' ? <><span className="spin" aria-hidden="true" />{t('generating')}</> : <><Icon name="download" size={18} />{t('generate')}</>}
              </button>
              {req && blocking.length > 0 && <span className="muted">{t('fixN', { n: blocking.length })}</span>}
            </div>
            {gen.state === 'done' && (
              <div className="alert ok only-mobile" role="status">
                <Icon name="check" size={18} className="draw" />
                <span>{t('generated', { pages: gen.pages })} <a href={gen.url} download={packageName}>{t('download', { file: packageName })}</a></span>
              </div>
            )}
          </Step>
        </main>

        <Dossier
          t={t}
          req={req}
          rows={rows}
          blocking={blocking}
          pagesNow={req ? totalPages : 0}
          titleOf={title}
          gen={gen}
          canGenerate={canGenerate}
          shaking={shaking}
          onGenerate={tryGenerate}
          onJump={jumpTo}
          onCsv={exportCsv}
          packageName={packageName}
        />
      </div>
      <footer className="foot">{t('footerNote')}</footer>
    </div>
  )
}
