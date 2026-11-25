import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Home } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ---------- Page header & breadcrumb ---------- */

export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 hidden md:block">
      <ol className="flex flex-wrap items-center gap-1.5 text-small text-ink-muted">
        <li>
          <Link to="/client" aria-label="Dashboard" className="inline-flex size-6 items-center justify-center rounded-[6px] hover:bg-brand-soft hover:text-brand">
            <Home className="size-4" aria-hidden />
          </Link>
        </li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-ink-muted/60" aria-hidden />
            {it.to ? (
              <Link to={it.to} className="rounded-[4px] hover:text-brand">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {back}
        <div className="min-w-0">
          <h1 className="text-h1 text-ink md:text-h1-lg">{title}</h1>
          {subtitle && <p className="mt-1 text-small text-ink-muted md:text-body">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 id={id} className="text-h2 text-ink">
        {children}
      </h2>
      {action}
    </div>
  )
}

/** Card heading with the brand bar used on Boards 01B and 03C. */
export function CardTitle({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-h3 text-ink">
        {icon ?? <span className="h-5 w-1 rounded-full bg-brand" aria-hidden />}
        {children}
      </h3>
      {action}
    </div>
  )
}

/* ---------- Data display ---------- */

export function StatCard({ icon, label, value, tone = 'brand', to }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'brand' | 'accent' | 'success'; to?: string }) {
  const iconTone = { brand: 'bg-brand-soft text-brand', accent: 'bg-accent-soft text-accent-strong', success: 'bg-success-soft text-success' }[tone]
  const inner = (
    <>
      <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-md sm:size-11', iconTone)}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-small text-ink-muted">{label}</span>
        <span className="tabular block text-h3 text-ink sm:truncate sm:text-h2">{value}</span>
      </span>
    </>
  )
  return to ? (
    <Link to={to} className="card-link flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      {inner}
    </Link>
  ) : (
    <div className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">{inner}</div>
  )
}

/** Fills from the left on mount and on change; transform only, so it never triggers layout. */
export function Progress({ value, className, tone = 'brand', label }: { value: number; className?: string; tone?: 'brand' | 'success'; label?: string }) {
  const v = Math.min(100, Math.max(0, value))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(v))
    return () => cancelAnimationFrame(id)
  }, [v])
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn('h-2 w-full overflow-hidden rounded-full bg-brand-soft', className)}>
      <div
        className={cn('h-full w-full origin-left rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none', tone === 'brand' ? 'bg-brand' : 'bg-success')}
        style={{ transform: `scaleX(${shown / 100})` }}
      />
    </div>
  )
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2 text-small', className)}>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular text-right font-semibold text-ink">{children}</dd>
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-lg bg-brand-soft text-brand">{icon}</span>
      <p className="text-h3 text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-small text-ink-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------- Stepper (Board 01B multi-step form) ---------- */

export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (i: number) => void }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const clickable = onStep && i < current
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden className="absolute right-1/2 top-[13px] h-0.5 w-full overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full w-full origin-left bg-brand transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                  style={{ transform: `scaleX(${i <= current ? 1 : 0})` }}
                />
              </span>
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStep(i)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s}${done ? ' (done)' : ''}`}
              className="group relative z-10 flex flex-col items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-300',
                  done && 'border-brand bg-brand text-white',
                  active && 'border-brand bg-surface',
                  !done && !active && 'border-line-control/40 bg-surface',
                )}
              >
                {done ? <Check className="size-4 animate-check" strokeWidth={3} aria-hidden /> : active ? <span className="size-2.5 animate-check rounded-full bg-brand" /> : null}
              </span>
              <span className={cn('hidden text-small sm:block', active ? 'font-semibold text-brand' : done ? 'font-medium text-ink' : 'text-ink-muted', clickable && 'group-hover:text-brand')}>{s}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Tabs ---------- */

/** The underline slides between tabs (ease-in-out: it moves on screen) instead of blinking in place. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ id: T; label: string; icon?: ReactNode; count?: number }>; value: T; onChange: (v: T) => void; label: string }) {
  const listRef = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const el = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (el) setBar({ x: el.offsetLeft + 8, w: el.offsetWidth - 16 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [value, tabs.length])

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  return (
    <div ref={listRef} role="tablist" aria-label={label} className="relative -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      {tabs.map((t, i) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative flex h-11 shrink-0 items-center gap-2 rounded-t-sm px-3 text-small font-medium transition-colors duration-150 ease-out',
              active ? 'text-brand' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className={cn('tabular rounded-full px-1.5 text-caption transition-colors duration-150', active ? 'bg-brand-soft' : 'bg-canvas')}>{t.count}</span>}
          </button>
        )
      })}
      {bar && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-[100px] origin-left rounded-full bg-brand transition-transform duration-300 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w / 100})` }}
        />
      )}
    </div>
  )
}
