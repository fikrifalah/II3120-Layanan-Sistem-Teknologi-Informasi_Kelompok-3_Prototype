import { useEffect, useRef } from 'react'
import Button from './Button.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Confirmation step for consequential actions (contract acceptance, payment release, dispute, reassignment).
 * Built on native <dialog>: focus trap, Esc to close, and inert background come from the browser.
 */
export default function ConfirmDialog({ open, onClose, onConfirm, title, confirmLabel, children }) {
  const { t } = useI18n()
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="confirm-title"
      className="w-[min(30rem,calc(100vw-2rem))] rounded-modal bg-surface p-0 text-ink shadow-float backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-8">
        <h2 id="confirm-title" className="text-h3">
          {title}
        </h2>
        <div className="flex flex-col gap-4 text-body text-ink-muted">{children}</div>
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  )
}
