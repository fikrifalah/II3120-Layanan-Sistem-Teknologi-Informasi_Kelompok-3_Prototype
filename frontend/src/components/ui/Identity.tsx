import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

/**
 * Anonymous avatar: a symmetric 5×5 pattern derived from the candidate handle.
 * Recognisable from card to card, but carries no face, gender, age or ethnicity.
 */
export function AnonAvatar({ seed, size = 48, className }: { seed: string; size?: number; className?: string }) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const bits: boolean[] = []
  for (let i = 0; i < 15; i++) bits.push(((h >>> i) & 1) === 1)
  const palettes = [
    ['#4A3FC1', '#EEEBFF'],
    ['#352B94', '#E6E3FA'],
    ['#944600', '#FFF1DB'],
    ['#067647', '#ECFDF3'],
    ['#175CD3', '#EFF8FF'],
  ]
  const [fg, bg] = palettes[(h >>> 20) % palettes.length]
  const cells: Array<[number, number]> = []
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++)
      if (bits[y * 3 + x]) {
        cells.push([x, y])
        if (x < 2) cells.push([4 - x, y])
      }
  return (
    <svg width={size} height={size} viewBox="-1 -1 7 7" role="img" aria-label={`Anonymous avatar for ${seed}`} className={cn('shrink-0 rounded-md', className)} style={{ background: bg }}>
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} rx={0.18} fill={fg} />
      ))}
    </svg>
  )
}

/** Revealed identity, shown only after the freelancer accepts: initials on brand ground. */
export function PersonAvatar({ initials, size = 48, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/** Counts from 0 to `target` once, ease-out, ~700ms. Static under reduced motion. */
function useCountUp(target: number, ms = 700) {
  const [n, setN] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0))
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(target)
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return n
}

/** Project-specific match score as a ring that fills and counts up when it first appears. */
export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = 15.5
  const c = 2 * Math.PI * r
  const n = useCountUp(score)
  const tone = score >= 85 ? '#067647' : score >= 70 ? '#4A3FC1' : '#944600'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#EEEBFF" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(n / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tabular font-bold text-ink" style={{ fontSize: size * 0.3 }} aria-hidden>
          {n}
        </span>
        <span className="sr-only">{score} out of 100 match score</span>
      </span>
    </div>
  )
}
