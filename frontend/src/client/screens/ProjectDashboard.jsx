import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageTop from '../../components/layout/PageTop.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Countdown from '../../components/ui/Countdown.jsx'
import OnChainBox from '../../components/ui/OnChainBox.jsx'
import Stepper from '../../components/ui/Stepper.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import MilestoneCard from '../components/MilestoneCard.jsx'
import { useI18n, useLocalized } from '../../i18n/index.jsx'
import usePageTitle from '../../lib/usePageTitle.js'
import { fetchContract } from '../api.js'
import { paths } from '../routes.js'

/** Layar 5 · Dashboard Proyek. Stepper, escrow balance, milestones, and on-chain proof. */
export default function ProjectDashboard() {
  const { t, number, date } = useI18n()
  const local = useLocalized()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [contract, setContract] = useState(null)
  const [failed, setFailed] = useState(false)
  const [quitOpen, setQuitOpen] = useState(false)

  usePageTitle(contract ? local(contract.title) : t('dash.crumb'))

  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    fetchContract(projectId, { signal: controller.signal })
      .then(setContract)
      .catch((err) => err.name !== 'AbortError' && setFailed(true))
    return () => controller.abort()
  }, [projectId])

  if (failed) {
    return (
      <>
        <PageTop crumb={t('dash.crumb')} />
        <Alert type="error" title={t('rec.error.title')}>
          {t('rec.error.desc')}
        </Alert>
      </>
    )
  }

  if (!contract) return <DashboardSkeleton crumb={t('dash.crumb')} />

  const { milestones } = contract
  const released = milestones.filter((m) => m.status === 'released')
  const disbursed = released.reduce((sum, m) => sum + m.amount, 0)
  const awaiting = milestones.find((m) => m.status === 'awaiting')
  const firstOpen = milestones.find((m) => m.status !== 'released')

  const steps = [
    { label: t('dash.steps.locked'), sub: t('dash.steps.done'), state: 'done' },
    ...milestones.map((m) => ({
      label: t('dash.steps.milestone', { n: m.milestone_id }),
      state: m.status === 'released' ? 'done' : m === firstOpen ? 'current' : 'upcoming',
      sub:
        m.status === 'released'
          ? t('dash.steps.released')
          : m.status === 'awaiting'
            ? t('dash.steps.awaiting')
            : m === firstOpen
              ? t('dash.steps.working')
              : t('dash.steps.upcoming'),
    })),
    { label: t('dash.steps.close'), sub: t('dash.steps.upcoming'), state: 'upcoming' },
  ]

  return (
    <>
      <PageTop crumb={`${t('dash.crumb')}  /  ${contract.project_id}`} />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-h1">{local(contract.title)}</h1>
            <StatusBadge status="active" />
          </div>
          <p className="mt-2 text-body text-ink-muted">
            {t('dash.meta', {
              id: contract.freelancer_id,
              date: date(contract.started_at),
              n: milestones.length,
            })}
          </p>
        </div>
        <Button variant="text" onClick={() => setQuitOpen(true)}>
          {t('dash.quit')}
        </Button>
      </header>

      <div className="flex flex-col gap-6">
        <section aria-label={t('dash.stats.locked')} className="grid gap-6 md:grid-cols-3">
          <Stat
            label={t('dash.stats.locked')}
            value={number(contract.locked_amount)}
            note={t('dash.stats.lockedNote')}
            badge={<StatusBadge status="funded" />}
          />
          <Stat
            label={t('dash.stats.disbursed')}
            value={number(disbursed)}
            note={t('dash.stats.disbursedNote', { a: released.length, b: milestones.length })}
          />
          <Stat
            label={t('dash.stats.remaining')}
            value={number(contract.locked_amount - disbursed)}
            note={t('dash.stats.remainingNote')}
          />
        </section>

        {awaiting && (
          <Alert type="warning" title={t('dash.banner.title', { n: awaiting.milestone_id })}>
            {t('dash.banner.desc')}
          </Alert>
        )}

        <Card className="flex flex-col gap-6">
          <h2 className="text-h3">{t('dash.progress')}</h2>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[34rem]">
              <Stepper steps={steps} label={t('dash.progress')} />
            </div>
          </div>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
          <section className="flex flex-col gap-4" aria-labelledby="ms-title">
            <h2 id="ms-title" className="text-h2">
              {t('dash.milestones')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {milestones.map((m) => (
                <MilestoneCard key={m.milestone_id} milestone={m} projectId={contract.project_id} />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            {awaiting && (
              <section className="flex flex-col gap-4" aria-labelledby="deadline-title">
                <h2 id="deadline-title" className="text-h2">
                  {t('dash.deadline.title')}
                </h2>
                <Card className="flex flex-col items-start gap-3 p-5">
                  <p className="text-small font-semibold text-ink-muted">
                    {t('dash.steps.milestone', { n: awaiting.milestone_id })}
                  </p>
                  <Countdown deadline={awaiting.review_deadline} />
                  <p className="text-small">{t('dash.deadline.body', { n: contract.review_timeout_days })}</p>
                </Card>
              </section>
            )}

            <section className="flex flex-col gap-4" aria-labelledby="chain-title">
              <h2 id="chain-title" className="text-h2">
                {t('dash.onchain.title')}
              </h2>
              <Card className="flex flex-col gap-3 p-4">
                <OnChainBox label={t('dash.onchain.contract')} value={contract.smart_contract_address} />
                <OnChainBox label={t('dash.onchain.lock')} value={contract.lock_transaction_hash} />
                {released.map((m) => (
                  <OnChainBox
                    key={m.milestone_id}
                    label={t('dash.onchain.release', { n: m.milestone_id })}
                    value={m.release_transaction_hash}
                  />
                ))}
              </Card>
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={quitOpen}
        onClose={() => setQuitOpen(false)}
        title={t('dash.quitDialog.title')}
        confirmLabel={t('dash.quitDialog.confirm')}
        onConfirm={() => navigate(paths.recommendations(), { state: { replacement: true } })}
      >
        <p>{t('dash.quitDialog.body')}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink">
          {t('dash.quitDialog.points').map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  )
}

function Stat({ label, value, note, badge }) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small text-ink-muted">{label}</p>
        {badge}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="tabular text-h1">{value}</span>
        <span className="text-small text-ink-muted">SIM-IDR</span>
      </p>
      <p className="text-caption font-normal text-ink-muted">{note}</p>
    </Card>
  )
}

function DashboardSkeleton({ crumb }) {
  return (
    <>
      <PageTop crumb={crumb} />
      <div className="flex flex-col gap-6" role="status" aria-busy="true">
        <div className="skeleton h-10 w-2/3" />
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 !rounded-card" />
          ))}
        </div>
        <div className="skeleton h-40 !rounded-card" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="skeleton h-64 !rounded-card" />
          <div className="skeleton h-64 !rounded-card" />
        </div>
      </div>
    </>
  )
}
