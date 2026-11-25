import { useEffect, useState } from 'react'
import { ChevronDown, EyeOff, Sparkles, User } from 'lucide-react'
import SkillTag from '../../components/ui/SkillTag.jsx'
import Button from '../../components/ui/Button.jsx'
import { useI18n, useLocalized } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'

/**
 * Anonymous candidate card. It only ever receives: id, score, years, skills, portfolio summary, explanation.
 * Never add a name, photo, or gender here: removing them is the bias mitigation.
 */
export default function CandidateCard({ candidate, selected, onSelect, index = 0 }) {
  const { t, score } = useI18n()
  const local = useLocalized()
  const [open, setOpen] = useState(false)
  const [grown, setGrown] = useState(false)

  // Grow the score bar once after mount. Transform only, so it stays on the compositor.
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const { freelancer_id: id, matching_score: value } = candidate
  const missing = candidate.missing_skills

  return (
    <article
      aria-label={id}
      style={{ animationDelay: `${index * 70}ms` }}
      className={cx(
        'flex animate-rise flex-col gap-4 rounded-card border p-6 transition-[background-color,border-color] duration-200 ease-out',
        selected ? 'border-2 border-primary bg-primary-subtle' : 'border-line bg-surface',
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-full text-primary',
            selected ? 'bg-surface' : 'bg-primary-subtle',
          )}
        >
          <User className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-h3">{id}</h3>
          <p className="text-small text-ink-muted">{t('rec.years', { n: candidate.experience_years })}</p>
        </div>
        <div className="text-right">
          <p
            className="tabular text-h2 leading-none text-primary"
            aria-label={`${t('rec.score')}: ${t('rec.scoreOf', { n: score(value) })}`}
          >
            {score(value)}
          </p>
          <p className="mt-1 text-caption text-ink-muted">{t('rec.score')}</p>
        </div>
      </header>

      <div
        className={cx('h-2 overflow-hidden rounded-full', selected ? 'bg-surface' : 'bg-line')}
        role="presentation"
      >
        <div
          data-motion="move"
          className="h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${grown ? value / 100 : 0})` }}
        />
      </div>

      <section className="flex flex-col gap-1">
        <h4 className="text-caption text-ink-muted">{t('rec.portfolio')}</h4>
        <p className={cx('text-small', !open && 'line-clamp-2')}>{local(candidate.portfolio_summary)}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-caption text-ink-muted">
          {t('rec.matched', { n: candidate.matched_skills.length })}
        </h4>
        <ul className="flex flex-wrap gap-2">
          {candidate.matched_skills.map((s) => (
            <li key={s}>
              <SkillTag type="matched">{s}</SkillTag>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-caption text-ink-muted">{t('rec.missing', { n: missing.length })}</h4>
        {missing.length ? (
          <ul className="flex flex-wrap gap-2">
            {missing.map((s) => (
              <li key={s}>
                <SkillTag type="missing">{s}</SkillTag>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-success">{t('rec.nothingMissing')}</p>
        )}
      </section>

      <section className="rounded-input bg-accent-subtle px-4 py-3">
        <h4 className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-warning">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t('rec.explanation')}
        </h4>
        <p className="text-small text-ink">{local(candidate.explanation)}</p>
      </section>

      <div className="mt-auto flex flex-col gap-3 pt-1">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t('rec.hide') : t('rec.view')}
            <ChevronDown
              className={cx('size-4 transition-transform duration-200 ease-out', open && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>
          <Button className="flex-1" aria-pressed={selected} onClick={() => onSelect(id)}>
            {selected ? t('rec.picked') : t('rec.pick')}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-caption font-normal text-ink-muted">
          <EyeOff className="size-3.5" aria-hidden="true" />
          {t('rec.anonymous')}
        </p>
      </div>
    </article>
  )
}
