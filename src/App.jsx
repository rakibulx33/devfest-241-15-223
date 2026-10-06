import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { t as tr } from './i18n.js'
import { parseRequirements } from './logic/requirements.js'
import { allStatuses, BLOCKING, duplicateIds, matchBlocker } from './logic/status.js'
import { inspectPdf, MAX_FILES, MAX_TOTAL_BYTES } from './logic/files.js'
import { buildPackage, parsePageList } from './logic/pack.js'
import { suggestMatches, applyAiAnswers } from './logic/automatch.js'
import { identifyDocument } from './logic/ai.js'
import { isIsoDate } from './logic/requirements.js'
import { loadProject, saveProject, clearProject } from './logic/saved.js'

const SAMPLE_DOCS = [
  '01_financial_proposal.pdf', '02_technical_proposal.pdf', '03_tin_certificate.pdf', '04_vat_certificate.pdf',
  'bank_solvency.pdf', 'company_logo.png', 'experience_cert (1).pdf', 'experience_cert.pdf', 'scan_0042.pdf',
  'trade_license_2025.pdf', 'trade_license_2026.pdf',
]
const ICON = { missing: '✕', expiry_needed: '!', expired: '⌛', not_provided: '–', ok: '✓' }
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
  const [apiKey, setApiKey] = useState('') // never stored
  const [ai, setAi] = useState({ state: 'idle' })
  const [loaded, setLoaded] = useState(false)
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

  const toggleLang = () => {
    const next = lang === 'en' ? 'bn' : 'en'
    store.set('lang', next)
    setLang(next)
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
    setFiles((prev) => prev.filter((f) => f.id !== id))
    const freed = Object.keys(matches).filter((r) => matches[r] === id)
    setMatches((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id)))
    setExpiry((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !freed.includes(k))))
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
  async function runAi() {
    const used = new Set(Object.values(matches))
    const todo = files.filter((f) => !f.error && !used.has(f.id))
    if (!todo.length) return setAi({ state: 'done', msgs: [{ key: 'aiNoFiles' }] })
    resetGen()
    const answers = []
    const msgs = []
    for (let i = 0; i < todo.length; i++) {
      setAi({ state: 'busy', done: i, total: todo.length })
      const res = await identifyDocument(apiKey.trim(), req.requirements, todo[i])
      if (res.error) {
        msgs.push({ key: 'ai_' + res.error, name: todo[i].name })
        if (res.error === 'bad_key') break
      } else answers.push({ fileId: todo[i].id, ...res })
    }
    const next = applyAiAnswers(req.requirements, files, matches, expiry, answers, req.tender.submission_deadline, isIsoDate)
    const n = Object.keys(next.matches).length - Object.keys(matches).length
    setMatches(next.matches)
    setExpiry(next.expiry)
    setAi({ state: 'done', msgs: [{ key: 'aiDone', total: todo.length, n }, ...msgs] })
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

  return (
    <div className="app" lang={lang}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">TP</span>
          <div>
            <h1>{t('appTitle')}</h1>
            <p className="sub">{t('appSub')}</p>
          </div>
        </div>
        <button className="btn ghost lang" onClick={toggleLang} aria-label={t('switchLangLabel')}>
          {t('switchLang')}
        </button>
      </header>

      <main>
        {restored && (
          <div className="alert ok restored" role="status">
            {t('restored')}{' '}
            <button className="btn small" onClick={startOver}>{t('startOver')}</button>
          </div>
        )}
        {/* Step 1 */}
        <section className="card" aria-labelledby="s1">
          <h2 id="s1">{t('step1')}</h2>
          <p className="help">{t('step1Help')}</p>
          <div className="actions">
            <button className="btn primary" onClick={() => jsonInput.current.click()}>{t('openJson')}</button>
            <button className="btn" onClick={loadSample}>{t('loadSample')}</button>
            {(req || files.length > 0) && <button className="btn ghost" onClick={startOver}>{t('startOver')}</button>}
            <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={onJsonFile} />
          </div>
          {reqErrors.length > 0 && (
            <div className="alert error" role="alert">
              <strong>{t('jsonErrorTitle')}</strong>
              <ul>{reqErrors.map((e, i) => <li key={i}>{t('rq_' + e.code, { ...e, field: e.field })}</li>)}</ul>
            </div>
          )}
          {req && (
            <dl className="tender">
              {[['tenderId', 'tender_id'], ['tenderTitle', 'title'], ['entity', 'procuring_entity'], ['bidder', 'bidder'], ['deadline', 'submission_deadline']].map(([k, f]) => (
                <div key={k}>
                  <dt>{t(k)}</dt>
                  <dd>{req.tender[f]}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Step 2 */}
        <section className="card" aria-labelledby="s2">
          <h2 id="s2">{t('step2')}</h2>
          <p className="help">{t('step2Help', { maxFiles: MAX_FILES, maxMb: MAX_MB })}</p>
          <div
            className={'drop' + (dragOver ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles([...e.dataTransfer.files]) }}
          >
            <button className="btn primary" onClick={() => pdfInput.current.click()}>{t('chooseFiles')}</button>
            <span className="muted">{t('dropHere')}</span>
            <button className="btn" onClick={loadSampleDocs}>{t('loadSampleDocs')}</button>
            <input ref={pdfInput} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />
          </div>
          {reading && <p className="muted" role="status">{t('reading')}</p>}
          {files.length === 0 ? (
            <p className="empty">{t('noFiles')}</p>
          ) : (
            <ul className="files">
              {files.map((f) => {
                const used = reqOfFile(f.id)
                const twins = files.filter((o) => o.id !== f.id && !o.error && o.hash === f.hash)
                return (
                  <li key={f.id} className={f.error ? 'bad' : dups.has(f.id) ? 'dup' : ''}>
                    <div className="fmain">
                      <span className="fname">{f.name}</span>
                      <span className="fmeta">
                        {f.error ? kb(f.size) : `${pagesLabel(f.pages)} · ${kb(f.size)}`}
                      </span>
                    </div>
                    <div className="ftags">
                      {f.error && <span className="tag t-bad">✕ {t('err_' + f.error, { maxFiles: MAX_FILES, maxMb: MAX_MB })}</span>}
                      {!f.error && dups.has(f.id) && (
                        <span className="tag t-dup" title={t('dupOf', { names: twins.map((o) => o.name).join(', ') })}>
                          ⧉ {t('dupBadge')} — {t('dupOf', { names: twins.map((o) => o.name).join(', ') })}
                        </span>
                      )}
                      {!f.error && (
                        <span className={'tag ' + (used ? 't-ok' : 't-idle')}>
                          {used ? t('matchedTo', { doc: title(used) }) : t('notMatched')}
                        </span>
                      )}
                    </div>
                    <button className="btn small" onClick={() => removeFile(f.id)} aria-label={t('removeLabel', { name: f.name })}>
                      {t('remove')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Step 3 */}
        <section className="card" aria-labelledby="s3">
          <h2 id="s3">{t('step3')}</h2>
          {!req ? (
            <p className="empty">{t('loadFirst')}</p>
          ) : (
            <>
              <p className="help">{t('step3Help')}</p>
              <div className="actions">
                <button className="btn" onClick={autoMatch} disabled={!files.some((f) => !f.error)}>{t('autoMatch')}</button>
                <button className="btn ghost" onClick={clearMatches} disabled={!Object.keys(matches).length}>{t('clearMatches')}</button>
                {notice && <span className="muted" role="status">{t(notice.key, notice)}</span>}
              </div>
              <details className="ai">
                <summary>{t('aiTitle')}</summary>
                <p className="help">{t('aiHelp')}</p>
                <p className="muted">{t('aiPrivacy')}</p>
                <div className="actions">
                  <label className="sr" htmlFor="apikey">{t('aiKey')}</label>
                  <input
                    id="apikey"
                    className="key-in"
                    type="password"
                    autoComplete="off"
                    placeholder={t('aiKey')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button className="btn" onClick={runAi} disabled={!apiKey.trim() || ai.state === 'busy'}>{t('aiRun')}</button>
                </div>
                {ai.state === 'busy' && <p className="muted" role="status">{t('aiRunning', ai)}</p>}
                {ai.state === 'done' && (
                  <ul className="ai-msgs" role="status">
                    {ai.msgs.map((m, i) => <li key={i}>{t(m.key, m)}</li>)}
                  </ul>
                )}
              </details>
              <table className="reqs">
                <thead>
                  <tr>
                    <th scope="col">{t('colOrder')}</th>
                    <th scope="col">{t('colDoc')}</th>
                    <th scope="col">{t('colFile')}</th>
                    <th scope="col">{t('colExpiry')}</th>
                    <th scope="col">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ req: r, status }) => {
                    const selId = 'sel-' + r.id
                    return (
                      <tr key={r.id} className={'row-' + status}>
                        <td data-label={t('colOrder')} className="ord">{r.order}</td>
                        <td data-label={t('colDoc')}>
                          <div className="dname">{title(r)}</div>
                          <div className="dtags">
                            <span className={'chip ' + (r.mandatory ? 'c-req' : 'c-opt')}>{r.mandatory ? t('mandatory') : t('optional')}</span>
                            {r.has_expiry && <span className="chip c-exp">{t('hasExpiry')}</span>}
                          </div>
                        </td>
                        <td data-label={t('colFile')}>
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
                        </td>
                        <td data-label={t('colExpiry')}>
                          {!r.has_expiry ? (
                            <span className="muted">{t('notNeeded')}</span>
                          ) : !matches[r.id] ? (
                            <span className="muted">{t('pickFileFirst')}</span>
                          ) : (
                            <input
                              type="date"
                              aria-label={t('expiryLabel', { doc: title(r) })}
                              value={expiry[r.id] || ''}
                              onChange={(e) => { resetGen(); setExpiry((x) => ({ ...x, [r.id]: e.target.value })) }}
                            />
                          )}
                        </td>
                        <td data-label={t('colStatus')}>
                          <span className={'status s-' + status}>
                            <span aria-hidden="true">{ICON[status]}</span> {t('st_' + status)}
                          </span>
                          <div className="hint">{t('hint_' + status, { deadline: req.tender.submission_deadline })}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* Step 4 */}
        {req && (
          <section className="card" aria-labelledby="s4">
            <h2 id="s4">{t('step4')}</h2>
            <p className="summary">
              {t('summary', {
                ok: rows.filter((r) => r.status === 'ok').length,
                blocked: blocking.length,
                skipped: rows.filter((r) => r.status === 'not_provided').length,
              })}
            </p>
            {blocking.length > 0 ? (
              <div className="alert warn" id="why-blocked">
                <strong>{t('blockedTitle')}</strong>
                <ul>
                  {blocking.map(({ req: r, status }) => (
                    <li key={r.id}>
                      <span className={'status s-' + status}><span aria-hidden="true">{ICON[status]}</span> {t('st_' + status)}</span>{' '}
                      {r.order}. {title(r)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert ok">{t('readyTitle', { pages: totalPages })}</div>
            )}
            <label className="check">
              <input type="checkbox" checked={withIndex} onChange={(e) => { resetGen(); setWithIndex(e.target.checked) }} />
              {t('withIndex')}
            </label>
            <fieldset className="seal">
              <legend>{t('sealTitle')}</legend>
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
              {seal?.error && <div className="alert error" role="alert">{t('sealBadPng')}</div>}
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
                    {sealInvalid && <div className="alert error" role="alert">{t('sealPagesBad', { total: totalPages })}</div>}
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
            </fieldset>
            <div className="actions">
              <button
                className="btn primary big"
                onClick={generate}
                disabled={blocking.length > 0 || sealInvalid || gen.state === 'busy'}
                aria-describedby={blocking.length ? 'why-blocked' : undefined}
              >
                {gen.state === 'busy' ? t('generating') : t('generate')}
              </button>
              <button className="btn" onClick={exportCsv}>{t('exportCsv')}</button>
            </div>
            {gen.state === 'done' && (
              <div className="alert ok" role="status">
                {t('generated', { pages: gen.pages })}{' '}
                <a href={gen.url} download={packageName}>{t('download', { file: packageName })}</a>
              </div>
            )}
            {gen.state === 'error' && <div className="alert error" role="alert">{t('genError', { msg: gen.msg })}</div>}
          </section>
        )}
      </main>
      <footer className="foot">{t('footerNote')}</footer>
    </div>
  )
}
