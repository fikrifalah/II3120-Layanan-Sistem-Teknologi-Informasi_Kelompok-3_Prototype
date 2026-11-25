import { Check } from 'lucide-react'
import { cx } from '../../lib/utils.js'

/**
 * Horizontal progress stepper.
 * steps: [{ label, sub, state: 'done' | 'current' | 'upcoming' }]
 * Done = check, current = ringed number, upcoming = muted number. Connectors fill once the left step is done.
 */
export default function Stepper({ steps, label }) {
  return (
    <ol aria-label={label} className="flex items-start">
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        return (
          <li
            key={`${step.label}-${i}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cx('flex items-start', !last && 'flex-1')}
          >
            <div className="flex w-24 flex-col items-center gap-2 text-center sm:w-28">
              <span
                className={cx(
                  'grid size-8 place-items-center rounded-full text-small font-bold tabular transition-colors duration-200 ease-out',
                  step.state === 'done' && 'bg-success text-white',
                  step.state === 'current' && 'border-[3px] border-primary bg-surface text-primary',
                  step.state === 'upcoming' && 'border-2 border-line bg-page text-ink-muted',
                )}
              >
                {step.state === 'done' ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className="flex flex-col">
                <span
                  className={cx(
                    'text-small font-semibold',
                    step.state === 'upcoming' ? 'text-ink-muted' : 'text-ink',
                  )}
                >
                  {step.label}
                </span>
                <span className="text-caption text-ink-muted">{step.sub}</span>
              </span>
            </div>
            {!last && (
              <span
                aria-hidden="true"
                className={cx(
                  'mt-[15px] h-[3px] min-w-6 flex-1 rounded-full',
                  step.state === 'done' ? 'bg-success' : 'bg-line',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
