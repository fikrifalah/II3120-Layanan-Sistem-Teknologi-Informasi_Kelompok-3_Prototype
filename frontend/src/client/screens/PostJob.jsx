import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Sparkles, UserCheck } from 'lucide-react'
import PageTop from '../../components/layout/PageTop.jsx'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import { SelectField, TagField, TextField } from '../../components/ui/Field.jsx'
import { useI18n } from '../../i18n/index.jsx'
import usePageTitle from '../../lib/usePageTitle.js'
import { DEMO_JOB, MIN_BUDGET, SKILL_SUGGESTIONS } from '../mock.js'
import { paths } from '../routes.js'

const CATEGORIES = ['support', 'frontend', 'backend', 'data', 'ml']
const STEP_ICONS = [Sparkles, UserCheck, Lock]

/** Layar 1 · Pasang Pekerjaan. Validation is inline, per field, and runs on submit. */
export default function PostJob() {
  const { t, number } = useI18n()
  const navigate = useNavigate()
  usePageTitle(t('post.h1'))

  const [form, setForm] = useState({ title: '', category: '', skills: [], budget: '' })
  const [submitted, setSubmitted] = useState(false)

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const budgetNumber = Number(form.budget || 0)

  const errors = {
    title: !form.title.trim() && t('post.title.error'),
    category: !form.category && t('post.category.error'),
    skills: form.skills.length === 0 && t('post.skills.error'),
    budget: budgetNumber < MIN_BUDGET && t('post.budget.error', { min: number(MIN_BUDGET) }),
  }
  const show = (key) => (submitted ? errors[key] || undefined : undefined)

  const onSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) {
      // wait for the error attributes to render, then move focus to the first problem
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    navigate(paths.recommendations(DEMO_JOB.job_id), {
      state: {
        job: {
          job_id: DEMO_JOB.job_id,
          job_title: form.title.trim(),
          category: form.category,
          required_skills: form.skills,
          budget: budgetNumber,
        },
      },
    })
  }

  const steps = t('post.aside.steps')

  return (
    <>
      <PageTop crumb={t('post.crumb')} />

      <header className="mb-8 max-w-2xl">
        <h1 className="text-h1">{t('post.h1')}</h1>
        <p className="mt-1.5 text-body text-ink-muted">{t('post.sub')}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6 p-8">
          <TextField
            label={t('post.title.label')}
            placeholder={t('post.title.placeholder')}
            helper={t('post.title.helper')}
            error={show('title')}
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            autoComplete="off"
          />
          <SelectField
            label={t('post.category.label')}
            placeholder={t('post.category.placeholder')}
            error={show('category')}
            value={form.category}
            onChange={(e) => set('category')(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`post.category.options.${c}`) }))}
          />
          <TagField
            label={t('post.skills.label')}
            placeholder={t('post.skills.placeholder')}
            helper={t('post.skills.helper')}
            maxLabel={t('post.skills.max')}
            suggestionsLabel={t('post.skills.suggestions')}
            removeLabel={t('post.skills.remove', { name: '{name}' })}
            error={show('skills')}
            value={form.skills}
            onChange={set('skills')}
            suggestions={SKILL_SUGGESTIONS}
          />
          <TextField
            label={t('post.budget.label')}
            helper={t('post.budget.helper')}
            error={show('budget')}
            suffix="SIM-IDR"
            inputMode="numeric"
            autoComplete="off"
            placeholder="15.000"
            value={form.budget ? number(budgetNumber) : ''}
            onChange={(e) => set('budget')(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit">{t('post.submit')}</Button>
          </div>
        </Card>

        <Card as="aside" className="bg-accent-subtle border-transparent p-6">
          <h2 className="mb-4 text-h3">{t('post.aside.title')}</h2>
          <ol className="flex flex-col gap-5">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <li key={s.title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-primary">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-small font-semibold">{s.title}</p>
                    <p className="text-small text-ink">{s.body}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>
    </>
  )
}
