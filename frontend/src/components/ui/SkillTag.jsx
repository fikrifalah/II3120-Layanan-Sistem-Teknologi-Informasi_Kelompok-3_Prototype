import { CheckCircle2, MinusCircle } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'

/** matched = terpenuhi (green + check). missing = belum terpenuhi (amber + minus). */
export default function SkillTag({ type, children }) {
  const { t } = useI18n()
  const matched = type === 'matched'
  const Icon = matched ? CheckCircle2 : MinusCircle
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-2.5 pr-3 text-caption',
        matched
          ? 'border-success bg-success-subtle text-success'
          : 'border-warning bg-warning-subtle text-warning',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" strokeWidth={2.25} />
      {children}
      <span className="sr-only"> ({t(`skill.${type}`)})</span>
    </span>
  )
}
