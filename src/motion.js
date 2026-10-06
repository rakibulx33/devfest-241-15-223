// Motion helpers shared by the UI: reduced-motion check, animated counter, click ripple.
import { useEffect, useRef, useState } from 'react'

export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Animates a number towards `target` (jumps straight to it when the user prefers reduced motion).
export function useCountUp(target, ms = 450) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  const calm = reducedMotion()
  useEffect(() => {
    if (calm) { from.current = target; return }
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
  }, [target, ms, calm])
  return calm ? target : value
}

// Click ripple on every .btn (one document-level listener; no per-button wiring).
export function useRipple() {
  useEffect(() => {
    const onDown = (e) => {
      const b = e.target.closest?.('.btn')
      if (!b || b.disabled || b.classList.contains('is-off') || reducedMotion()) return
      const r = b.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2
      const dot = document.createElement('span')
      dot.className = 'ripple'
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      b.appendChild(dot)
      setTimeout(() => dot.remove(), 650)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}

