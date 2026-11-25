import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2,
  Briefcase,
  FileText,
  Home,
  MessageSquare,
  Plus,
  Search,
  Wallet,
} from 'lucide-react'
import Logo from '../ui/Logo.jsx'
import Button from '../ui/Button.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { cx } from '../../lib/utils.js'
import { CLIENT_BASE } from '../../client/routes.js'

const NAV = [
  { key: 'dashboard', to: CLIENT_BASE, icon: Home, end: true },
  { key: 'findTalent', to: `${CLIENT_BASE}/talent`, icon: Search },
  { key: 'jobPosts', to: `${CLIENT_BASE}/jobs`, icon: FileText },
  { key: 'contracts', to: `${CLIENT_BASE}/contracts`, icon: Briefcase },
  { key: 'messages', to: `${CLIENT_BASE}/messages`, icon: MessageSquare },
  { key: 'payments', to: `${CLIENT_BASE}/payments`, icon: Wallet },
  { key: 'company', to: `${CLIENT_BASE}/company`, icon: Building2 },
]

/**
 * Client layout: 240px sidebar on desktop, a slide-in drawer below 1024px.
 * Pages render <PageTop /> themselves so each can set its own breadcrumb.
 */
export default function ClientShell() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-input bg-primary px-4 py-2 text-small font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('app.skip')}
      </a>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="client-sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-6',
          'transition-[transform,visibility] duration-300 ease-drawer',
          'lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none',
          menuOpen ? 'translate-x-0 shadow-float' : 'max-lg:invisible max-lg:-translate-x-full',
        )}
      >
        <NavLink to={CLIENT_BASE} className="px-2" aria-label="Gigly">
          <Logo className="h-10 w-auto" />
        </NavLink>

        <Button as={NavLink} to={`${CLIENT_BASE}/jobs/new`} className="w-full">
          <Plus className="size-4" aria-hidden="true" />
          {t('nav.postJob')}
        </Button>

        <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1">
          {NAV.map(({ key, to, icon: Icon, end }) => (
            <NavLink
              key={key}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-11 items-center gap-3 rounded-input px-3 text-small font-semibold',
                  'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]',
                  isActive
                    ? 'bg-primary-subtle text-primary'
                    : 'text-ink-muted [@media(hover:hover)]:hover:bg-page [@media(hover:hover)]:hover:text-ink',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-input bg-accent-subtle px-3 py-3">
          <p className="text-caption text-warning">{t('app.simulationTitle')}</p>
          <p className="text-caption font-normal text-ink">{t('app.simulationBody')}</p>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
        <div className="mx-auto w-full max-w-content px-5 pb-16 pt-5 md:px-10">
          <Outlet context={{ openMenu: () => setMenuOpen(true), menuOpen }} />
        </div>
      </main>
    </div>
  )
}
