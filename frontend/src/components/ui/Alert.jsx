import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cx } from '../../lib/utils.js'

const TYPES = {
  info: { icon: Info, tone: 'border-warning/60 bg-accent-subtle', iconTone: 'text-warning' },
  warning: { icon: AlertTriangle, tone: 'border-warning/60 bg-warning-subtle', iconTone: 'text-warning' },
  error: { icon: XCircle, tone: 'border-danger/60 bg-danger-subtle', iconTone: 'text-danger' },
  success: { icon: CheckCircle2, tone: 'border-success/60 bg-success-subtle', iconTone: 'text-success' },
}

/** Banner with icon, bold title, and a sentence of detail. Errors are announced immediately. */
export default function Alert({ type = 'info', title, children, className }) {
  const { icon: Icon, tone, iconTone } = TYPES[type]
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-input border px-4 py-3.5', tone, className)}
    >
      <Icon className={cx('mt-0.5 size-5 shrink-0', iconTone)} aria-hidden="true" />
      <div className="min-w-0 text-small">
        <p className="font-semibold text-ink">{title}</p>
        {children && <p className="text-ink">{children}</p>}
      </div>
    </div>
  )
}
