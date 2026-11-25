import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type AlertTone = 'success' | 'warning' | 'danger' | 'info' | 'brand'

const alertStyles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  success: { box: 'bg-success-soft border-success/15', icon: <CheckCircle2 className="size-5 text-success" aria-hidden /> },
  warning: { box: 'bg-accent-soft border-accent/30', icon: <AlertTriangle className="size-5 text-accent-strong" aria-hidden /> },
  danger: { box: 'bg-danger-soft border-danger/15', icon: <XCircle className="size-5 text-danger" aria-hidden /> },
  info: { box: 'bg-info-soft border-info/15', icon: <Info className="size-5 text-info" aria-hidden /> },
  brand: { box: 'bg-brand-soft border-brand/10', icon: <Info className="size-5 text-brand" aria-hidden /> },
}

/** Board 01B feedback row: icon + bold title + text. Status is never carried by colour alone. */
export function Alert({ tone = 'info', title, children, action, className }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-md border px-4 py-3', alertStyles[tone].box, className)}>
      <span className="mt-px shrink-0">{alertStyles[tone].icon}</span>
      <div className="min-w-0 flex-1 text-small text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink-muted')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

/**
 * Native <dialog> modal: focus trap, Esc and the backdrop come from the browser.
 * It materialises in (240ms) and leaves faster (160ms) — the exit is the system responding.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.removeAttribute('data-closing')
      d.showModal()
      // Start where the user will act: the first field, else the primary action — not the close button.
      const target = d.querySelector<HTMLElement>('textarea, input, select') ?? d.querySelector<HTMLElement>('[data-dialog-footer] button:last-child')
      target?.focus({ preventScroll: true })
    }
    if (!open && d.open) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      d.setAttribute('data-closing', '')
      const t = setTimeout(() => {
        d.close()
        d.removeAttribute('data-closing')
      }, reduce ? 0 : 160)
      return () => clearTimeout(t)
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault() // let Esc run the same exit animation as the close button
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn('w-[calc(100%-2rem)] rounded-lg bg-surface p-0 text-ink shadow-float', size === 'md' ? 'max-w-md' : 'max-w-xl')}
      aria-labelledby="dialog-title"
    >
      <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
        <h2 id="dialog-title" className="text-h2">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-1 inline-flex size-10 items-center justify-center rounded-sm text-ink-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-canvas hover:text-ink active:scale-90"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-6 pb-6 text-small text-ink-muted">{children}</div>
      {footer && (
        <div data-dialog-footer className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </dialog>
  )
}

/* ---------- Toasts ---------- */

interface ToastItem {
  id: number
  tone: AlertTone
  title: string
  body?: string
}

const ToastContext = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {})

/**
 * Toasts use transitions, not keyframes, so a quick second toast retargets smoothly.
 * They slide up from the bottom edge, pause while hovered, and leave the way they came.
 */
function Toast({ t, onDone }: { t: ToastItem; onDone: (id: number) => void }) {
  const [state, setState] = useState<'enter' | 'shown' | 'leave'>('enter')
  const hovered = useRef(false)
  const remaining = useRef(4800)

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setState('shown')))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (state !== 'shown') return
    let started = Date.now()
    let timer = setTimeout(() => setState('leave'), remaining.current)
    const pause = () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
    const resume = () => {
      started = Date.now()
      timer = setTimeout(() => setState('leave'), Math.max(800, remaining.current))
    }
    const onVis = () => (document.hidden ? pause() : !hovered.current && resume())
    document.addEventListener('visibilitychange', onVis)
    const el = document.getElementById(`toast-${t.id}`)
    const enter = () => {
      hovered.current = true
      pause()
    }
    const leave = () => {
      hovered.current = false
      resume()
    }
    el?.addEventListener('pointerenter', enter)
    el?.addEventListener('pointerleave', leave)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
      el?.removeEventListener('pointerenter', enter)
      el?.removeEventListener('pointerleave', leave)
    }
  }, [state, t.id])

  useEffect(() => {
    if (state !== 'leave') return
    const id = setTimeout(() => onDone(t.id), 220)
    return () => clearTimeout(id)
  }, [state, t.id, onDone])

  return (
    <div
      id={`toast-${t.id}`}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 shadow-float',
        'transition-[transform,opacity] motion-reduce:transition-opacity',
        state === 'enter' && 'translate-y-4 opacity-0',
        state === 'shown' && 'translate-y-0 opacity-100 duration-[400ms] ease-out',
        state === 'leave' && 'translate-y-2 scale-[0.98] opacity-0 duration-200 ease-out',
      )}
    >
      <span className="mt-px">{alertStyles[t.tone].icon}</span>
      <div className="min-w-0 flex-1 text-small">
        <p className="font-semibold text-ink">{t.title}</p>
        {t.body && <p className="text-ink-muted">{t.body}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setState('leave')}
        className="-mr-1 inline-flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-[background-color,transform] duration-150 hover:bg-canvas active:scale-90"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-2), { ...t, id }])
  }, [])
  const done = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6">
        {items.map((t) => (
          <Toast key={t.id} t={t} onDone={done} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
