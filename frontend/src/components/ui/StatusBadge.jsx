import { AlertTriangle, Check, Circle, Clock, Eye, Lock } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'

/** Status is always icon + text + color, never color alone. */
const STATUS = {
  pending: { icon: Clock, tone: 'bg-warning-subtle text-warning' },
  active: { icon: Circle, tone: 'bg-primary-subtle text-primary-hover', fill: true },
  inReview: { icon: Eye, tone: 'bg-accent-subtle text-warning' },
  completed: { icon: Check, tone: 'bg-success-subtle text-success' },
  disputed: { icon: AlertTriangle, tone: 'bg-danger-subtle text-danger' },
  funded: { icon: Lock, tone: 'bg-primary-subtle text-primary-hover' },
}

export default function StatusBadge({ status, className }) {
  const { t } = useI18n()
  const { icon: Icon, tone, fill } = STATUS[status]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2.5 pr-3 text-caption',
        tone,
        className,
      )}
    >
      <Icon className={cx('size-3.5', fill && 'fill-current')} aria-hidden="true" strokeWidth={2.25} />
      {t(`status.${status}`)}
    </span>
  )
}
