import { Link } from 'react-router-dom'
import { Check, Clock, Lock } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Button from '../../components/ui/Button.jsx'
import { useI18n, useLocalized } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'
import { paths } from '../routes.js'

/**
 * Payment stage is explicit: funded -> awaiting approval -> released.
 * Every card says who acts next, so nobody has to guess.
 */
const STAGE = {
  funded: { badge: 'funded', next: 'freelancer', icon: Lock, panel: 'bg-page text-ink' },
  awaiting: { badge: 'inReview', next: 'you', icon: Clock, panel: 'bg-accent-subtle text-ink' },
  released: { badge: 'completed', next: 'none', icon: Check, panel: 'bg-page text-ink' },
}

export default function MilestoneCard({ milestone, projectId }) {
  const { t, number, date } = useI18n()
  const local = useLocalized()
  const stage = STAGE[milestone.status]
  const NextIcon = stage.icon

  const when =
    milestone.status === 'released'
      ? t('dash.approvedOn', { date: date(milestone.approved_at) })
      : milestone.status === 'awaiting'
        ? t('dash.submittedOn', { date: date(milestone.submitted_at) })
        : t('dash.dueOn', { date: date(milestone.due_at) })

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
      <header className="flex flex-col items-start gap-2.5">
        <StatusBadge status={stage.badge} />
        <div>
          <p className="text-caption text-ink-muted">{t('dash.milestoneLabel', { n: milestone.milestone_id })}</p>
          <h3 className="text-h3">{local(milestone.title)}</h3>
        </div>
      </header>

      <p className="flex items-baseline gap-2">
        <span className="tabular text-h2">{number(milestone.amount)}</span>
        <span className="text-small text-ink-muted">SIM-IDR</span>
      </p>

      <p className="flex flex-wrap gap-x-4 text-small text-ink-muted">
        <span>{t('dash.kpi', { n: milestone.kpi_count })}</span>
        <span>{when}</span>
      </p>

      <p className={cx('flex items-start gap-2 rounded-input px-3 py-2.5 text-small', stage.panel)}>
        <NextIcon
          className={cx(
            'mt-0.5 size-4 shrink-0',
            milestone.status === 'released' ? 'text-success' : milestone.status === 'awaiting' ? 'text-warning' : 'text-ink-muted',
          )}
          aria-hidden="true"
        />
        {t(`dash.next.${stage.next}`)}
      </p>

      {milestone.status === 'awaiting' && (
        <Button as={Link} to={paths.review(projectId, milestone.milestone_id)} className="mt-auto w-full">
          {t('dash.review')}
        </Button>
      )}
    </article>
  )
}
