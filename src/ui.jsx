// Small presentational pieces (icons, stepper, status stamp, language switch, package panel).
// No business logic here: App.jsx owns the state and passes plain values in.
import { useEffect, useRef, useState } from 'react'

// ---------- Icons (Lucide-style strokes, one consistent set) ----------
const PATHS = {
  check: <path pathLength="1" d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  minus: <path d="M5 12h14" />,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h6" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  reset: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
}

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg className={'ico ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}

export const STATUS_ICON = { ok: 'check', missing: 'x', expiry_needed: 'alert', expired: 'clock', not_provided: 'minus' }

export function BrandMark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path d="M9 7h10l5 5v13H9z" fill="#fff" />
      <path d="M19 7v5h5" fill="#bcd5c9" />
      <path className="mark-check" pathLength="1" d="M12.5 18l2.5 2.5 4.5-5" stroke="#0b5d46" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------- Hooks ----------
export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Animates a number towards `target` (skipped when the user prefers reduced motion).
export function useCountUp(target, ms = 450) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reducedMotion()) { from.current = target; setValue(target); return }
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms)
      const val = Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)))
      from.current = val
      setValue(val)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

// ---------- Small components ----------
// Render with key={status} so the stamp animation replays whenever the status changes.
export function StatusStamp({ status, label }) {
  return (
    <span className={'status s-' + status}>
      <Icon name={STATUS_ICON[status]} size={14} />
      {label}
    </span>
  )
}

export function LangSwitch({ lang, onChange, label }) {
  return (
    <div className="langsw" role="group" aria-label={label} data-lang={lang}>
      <span className="pill" aria-hidden="true" />
      <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => onChange('en')}>English</button>
      <button type="button" lang="bn" aria-pressed={lang === 'bn'} onClick={() => onChange('bn')}>বাংলা</button>
    </div>
  )
}

export function Step({ n, done, id, title, help, last, t, children }) {
  return (
    <section className={'step' + (done ? ' done' : '')} aria-labelledby={id}>
      <div className="rail" aria-hidden="true">
        <span className="dot">{done ? <Icon name="check" size={16} className="draw" /> : n}</span>
        {!last && <span className="line" />}
      </div>
      <div className="step-body">
        <h2 id={id}><span className="sr">{t('stepWord', { n })}: </span>{title}</h2>
        {help && <p className="help">{help}</p>}
        {children}
      </div>
    </section>
  )
}

// One segment per required document, in tender order. Doubles as a mini-map: click to jump to the row.
function StatusStrip({ rows, t, titleOf, onJump }) {
  return (
    <ol className="strip" aria-label={t('stripLabel')}>
      {rows.map(({ req, status }) => (
        <li key={req.id}>
          <button type="button" className={'seg seg-' + status} onClick={() => onJump(req.id)}
            title={`${req.order}. ${titleOf(req)} — ${t('st_' + status)}`}
            aria-label={`${req.order}. ${titleOf(req)}: ${t('st_' + status)}`} />
        </li>
      ))}
    </ol>
  )
}

// The "dossier": a live paper stack of the package-to-be, with status map and the Generate action.
export function Dossier({ t, req, rows, blocking, pagesNow, titleOf, gen, canGenerate, onGenerate, onJump, onCsv, packageName }) {
  const pages = useCountUp(pagesNow)
  const state = !req ? 'empty' : blocking.length ? 'todo' : 'ready'
  const busy = gen.state === 'busy'
  return (
    <aside className="dossier" aria-label={t('dossierTitle')} data-state={state}>
      <div className="stack">
        <span className="sheet back2" aria-hidden="true" />
        <span className="sheet back1" aria-hidden="true" />
        <div className="sheet front">
          {req ? (
            <>
              <div className="f-id">{req.tender.tender_id}</div>
              <div className="f-title">{req.tender.title}</div>
              <div className="f-pages" aria-live="polite">
                <span className="num">{pages}</span>
                <span>{t('pagesWord')}</span>
              </div>
              <span className={'corner ' + (state === 'ready' ? 'c-ready' : 'c-fix')}>
                <Icon name={state === 'ready' ? 'check' : 'alert'} size={14} />
                {state === 'ready' ? t('tagReady') : t('tagFix', { n: blocking.length })}
              </span>
            </>
          ) : (
            <div className="f-empty">{t('dossierEmpty')}</div>
          )}
        </div>
      </div>

      {req && <StatusStrip rows={rows} t={t} titleOf={titleOf} onJump={onJump} />}
      {req && (
        <p className="d-sum">
          {blocking.length
            ? t('summary', {
                ok: rows.filter((r) => r.status === 'ok').length,
                blocked: blocking.length,
                skipped: rows.filter((r) => r.status === 'not_provided').length,
              })
            : t('allReady')}
        </p>
      )}
      {req && blocking.length > 0 && (
        <ul className="d-list" id="why-blocked">
          {blocking.map(({ req: r, status }) => (
            <li key={r.id}>
              <button type="button" onClick={() => onJump(r.id)} aria-label={t('jumpTo', { doc: titleOf(r) })}>
                <StatusStamp key={status} status={status} label={t('st_' + status)} />
                <span className="d-name">{r.order}. {titleOf(r)}</span>
                <Icon name="chevron" size={16} className="go" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn primary big block gen" onClick={onGenerate} disabled={!canGenerate}
        aria-describedby={blocking.length ? 'why-blocked' : undefined}>
        {busy ? <><span className="spin" aria-hidden="true" />{t('generating')}</> : <><Icon name="download" size={18} />{t('generate')}</>}
      </button>
      <p className="d-hint">{!req ? t('loadFirst') : blocking.length ? t('fixN', { n: blocking.length }) : ''}</p>

      {gen.state === 'done' && (
        <div className="d-done" role="status">
          <Icon name="check" size={18} className="draw" />
          <span>{t('generated', { pages: gen.pages })} <a href={gen.url} download={packageName}>{t('download', { file: packageName })}</a></span>
        </div>
      )}
      {gen.state === 'error' && <div className="d-err" role="alert">{t('genError', { msg: gen.msg })}</div>}
      {req && (
        <button type="button" className="btn ghost small d-csv" onClick={onCsv}>
          <Icon name="download" size={16} />{t('exportCsv')}
        </button>
      )}
    </aside>
  )
}
