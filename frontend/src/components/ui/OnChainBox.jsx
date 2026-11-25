import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Lock } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { truncateMiddle } from '../../lib/utils.js'

/**
 * Shows a long hash or address truncated (0x5FbD…0aa3) with a copy button.
 * The full value stays in the DOM (title + copy) so nothing is lost.
 */
export default function OnChainBox({ label, value, icon: Icon = Lock }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard can be unavailable on insecure origins */
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-input border border-line bg-page py-3 pl-4 pr-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption text-ink-muted">{label}</p>
        <p className="tabular truncate text-small font-semibold text-ink" title={value}>
          {truncateMiddle(value)}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={t('common.copyLabel', { label })}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-input border border-line bg-surface px-2.5 text-caption font-semibold text-primary transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:bg-primary-subtle"
      >
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? t('common.copied') : t('common.copy')}</span>
      </button>
    </div>
  )
}
