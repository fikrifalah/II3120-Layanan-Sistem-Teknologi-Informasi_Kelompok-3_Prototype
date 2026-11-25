import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Check, SearchX, TriangleAlert } from 'lucide-react'
import PageTop from '../../components/layout/PageTop.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import CandidateCard from '../components/CandidateCard.jsx'
import { useI18n, useLocalized } from '../../i18n/index.jsx'
import usePageTitle from '../../lib/usePageTitle.js'
import { fetchRecommendations } from '../api.js'
import { DEMO_JOB } from '../mock.js'
import { paths } from '../routes.js'

/**
 * Layar 2 · Rekomendasi AI.
 * Demo states for review: add ?state=loading | empty | error to the URL.
 */
export default function Recommendations() {
  const { t, number } = useI18n()
  const local = useLocalized()
  const location = useLocation()
  const [params] = useSearchParams()
  const forced = params.get('state')

  const job = location.state?.job ?? DEMO_JOB
  const replacement = Boolean(location.state?.replacement)

  const [status, setStatus] = useState('loading')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [attempt, setAttempt] = useState(0)

  usePageTitle(t('rec.h1'))

  useEffect(() => {
    if (forced === 'loading') return setStatus('loading')
    if (forced === 'empty') return setStatus('empty')
    if (forced === 'error') return setStatus('error')

    const controller = new AbortController()
    setStatus('loading')
    fetchRecommendations(job, { signal: controller.signal })
      .then((list) => {
        setItems(list)
        setStatus(list.length ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error')
      })
    return () => controller.abort()
    // job identity is stable per route visit; attempt/forced re-run the request on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, forced])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return (
    <>
      <PageTop crumb={`${t('rec.crumb')}  /  ${local(job.job_title)}`} />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-h1">{t('rec.h1')}</h1>
          <p className="mt-1.5 text-body text-ink-muted">{t('rec.sub')}</p>
        </div>
        <Button as={Link} to={paths.postJob} variant="secondary">
          {t('rec.edit')}
        </Button>
      </header>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-caption text-ink-muted">
                {t('rec.category')} · {t(`post.category.options.${job.category}`)}
              </p>
              <p className="text-h3">{local(job.job_title)}</p>
            </div>
            <div className="text-right">
              <p className="text-caption text-ink-muted">{t('rec.budget')}</p>
              <p className="tabular text-h3 text-primary">{number(job.budget)} SIM-IDR</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small text-ink-muted">{t('rec.skills')}:</span>
            {job.required_skills.map((s) => (
              <span key={s} className="rounded-full border border-line bg-page px-3 py-1 text-caption text-ink">
                {s}
              </span>
            ))}
          </div>
        </Card>

        {replacement && (
          <Alert type="warning" title={t('rec.replacement.title')}>
            {t('rec.replacement.desc')}
          </Alert>
        )}

        <Alert type="info" title={t('rec.banner.title')}>
          {t('rec.banner.desc')}
        </Alert>

        {status === 'loading' && <LoadingState />}
        {status === 'empty' && (
          <StateCard
            icon={SearchX}
            title={t('rec.empty.title')}
            desc={t('rec.empty.desc')}
            action={
              <Button as={Link} to={paths.postJob}>
                {t('rec.empty.action')}
              </Button>
            }
          />
        )}
        {status === 'error' && (
          <StateCard
            tone="error"
            icon={TriangleAlert}
            title={t('rec.error.title')}
            desc={t('rec.error.desc')}
            action={<Button onClick={retry}>{t('rec.error.action')}</Button>}
          />
        )}

        {status === 'ready' && (
          <>
            <p className="text-small font-semibold text-ink-muted">{t('rec.count', { n: items.length })}</p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((c, i) => (
                <CandidateCard
                  key={c.freelancer_id}
                  candidate={c}
                  index={i}
                  selected={selected === c.freelancer_id}
                  onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>

            {selected && (
              <div
                role="region"
                aria-live="polite"
                className="sticky bottom-4 z-10 flex animate-rise flex-wrap items-center gap-4 rounded-card border border-primary bg-primary-subtle/90 px-6 py-4 backdrop-blur-md"
              >
                <span className="grid size-8 place-items-center rounded-full bg-primary text-white">
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 text-body font-semibold">{t('rec.chosen', { id: selected })}</p>
                <Button as={Link} to={paths.contractDraft(job.job_id)} state={{ freelancerId: selected }}>
                  {t('rec.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function LoadingState() {
  const { t } = useI18n()
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div>
        <p className="text-h3">{t('rec.loading.title')}</p>
        <p className="text-small text-ink-muted">{t('rec.loading.desc')}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="skeleton size-12 !rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-5 w-28" />
                <div className="skeleton h-4 w-36" />
              </div>
            </div>
            <div className="skeleton h-2 w-full !rounded-full" />
            <div className="skeleton h-12 w-full" />
            <div className="flex gap-2">
              <div className="skeleton h-7 w-20 !rounded-full" />
              <div className="skeleton h-7 w-24 !rounded-full" />
            </div>
            <div className="skeleton h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function StateCard({ icon: Icon, title, desc, action, tone }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span
        className={`grid size-14 place-items-center rounded-full ${tone === 'error' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'}`}
      >
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-h3" role={tone === 'error' ? 'alert' : undefined}>
        {title}
      </h2>
      <p className="max-w-md text-body text-ink-muted">{desc}</p>
      <div className="pt-2">{action}</div>
    </Card>
  )
}
