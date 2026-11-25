import { useI18n } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'

const OPTIONS = [
  { value: 'id', label: 'ID', name: 'Bahasa Indonesia' },
  { value: 'en', label: 'EN', name: 'English' },
]

/** Pick one language. The UI is never mixed. */
export default function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="radiogroup"
      aria-label={t('app.language')}
      className="inline-flex rounded-full border border-line bg-surface p-1"
    >
      {OPTIONS.map((o) => {
        const on = lang === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.name}
            onClick={() => setLang(o.value)}
            className={cx(
              'min-h-9 min-w-11 rounded-full px-3.5 text-small font-semibold',
              'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
              on
                ? 'bg-primary text-white'
                : 'text-ink-muted [@media(hover:hover)]:hover:bg-primary-subtle [@media(hover:hover)]:hover:text-primary',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
