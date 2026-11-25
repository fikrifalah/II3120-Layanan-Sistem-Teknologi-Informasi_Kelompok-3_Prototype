import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Review countdown. Turns red-toned under 24 hours and never relies on color alone (clock icon + text). */
export default function Countdown({ deadline }) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const left = new Date(deadline).getTime() - now
  const urgent = left < DAY
  const days = Math.max(0, Math.floor(left / DAY))
  const hours = Math.max(0, Math.floor((left % DAY) / HOUR))

  const label =
    left <= 0
      ? t('dash.deadline.passed')
      : urgent
        ? t('dash.deadline.leftHours', { h: Math.max(1, Math.floor(left / HOUR)) })
        : t('dash.deadline.left', { d: days, h: hours })

  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border py-2 pl-3.5 pr-4 text-small font-semibold',
        urgent ? 'border-danger bg-danger-subtle text-danger' : 'border-warning bg-warning-subtle text-warning',
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      <span className="tabular">{label}</span>
    </span>
  )
}
