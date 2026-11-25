import { useOutletContext } from 'react-router-dom'
import { Menu, User } from 'lucide-react'
import LangSwitch from '../ui/LangSwitch.jsx'
import { useI18n } from '../../i18n/index.jsx'

/** Breadcrumb on the left, language switch and account on the right. Opens the drawer below 1024px. */
export default function PageTop({ crumb }) {
  const { t } = useI18n()
  const { openMenu, menuOpen } = useOutletContext() ?? {}
  return (
    <div className="mb-6 flex min-h-11 items-center gap-3">
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('app.openMenu')}
        aria-expanded={menuOpen ?? false}
        aria-controls="client-sidebar"
        className="grid size-11 place-items-center rounded-input border border-line bg-surface transition-transform duration-150 ease-out active:scale-[0.95] lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <p className="min-w-0 flex-1 truncate text-small text-ink-muted">{crumb}</p>
      <LangSwitch />
      <span
        role="img"
        aria-label={t('app.account')}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary"
      >
        <User className="size-5" aria-hidden="true" />
      </span>
    </div>
  )
}
