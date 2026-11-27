import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, Coins, LogOut, Menu, Search, X } from 'lucide-react'
import { cn } from '../lib/cn'

/**
 * The one workspace shell for every participant (client, freelancer, arbiter): sidebar, translucent
 * top bar, mobile drawer and bottom navigation. Each role only supplies its navigation and header tools.
 */

export interface NavItem {
  /** Route to open. Omit for items that open a panel or scroll the page. */
  to?: string
  onClick?: () => void
  label: string
  icon: ReactNode
  end?: boolean
  badge?: number
  disabled?: boolean
  /** Custom active test, for sections whose child routes overlap another item. */
  match?: (path: string) => boolean
}

function Logo({ home, className }: { home: string; className?: string }) {
  return (
    <Link to={home} aria-label="Gigly — dashboard" className={cn('inline-flex rounded-sm', className)}>
      <img src="/brand/gigly-logo.png" alt="Gigly" width={480} height={200} className="h-9 w-auto" />
    </Link>
  )
}

const sideClass = (active: boolean) =>
  cn(
    'group flex h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-small font-medium transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-45',
    active ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-canvas hover:text-ink',
  )

function SideLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const forced = item.match?.(pathname)
  const body = (
    <>
      <span className="shrink-0 transition-transform duration-200 ease-out group-active:scale-90" aria-hidden>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge ? <span className="tabular inline-flex size-5 items-center justify-center rounded-full bg-accent text-caption font-bold text-ink">{item.badge}</span> : null}
    </>
  )
  const click = () => {
    onNavigate?.()
    item.onClick?.()
  }
  if (!item.to || item.disabled)
    return (
      <button type="button" disabled={item.disabled} onClick={click} className={sideClass(Boolean(forced))}>
        {body}
      </button>
    )
  return (
    <NavLink to={item.to} end={item.end} onClick={click} aria-current={forced ? 'page' : undefined} className={({ isActive }) => sideClass(forced ?? isActive)}>
      {body}
    </NavLink>
  )
}

function SidebarBody({ nav, footerNav, note, onNavigate }: { nav: NavItem[]; footerNav?: NavItem[]; note?: ReactNode; onNavigate?: () => void }) {
  return (
    <>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => (
          <SideLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {note && <p className="mt-6 px-3 text-caption text-ink-muted">{note}</p>}
      {footerNav && (
        <div className="mt-6 flex flex-col gap-0.5 border-t border-line pt-4">
          {footerNav.map((item) => (
            <SideLink key={item.label} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </>
  )
}

/* ---------- Header tools ---------- */

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        className="h-11 w-full rounded-sm border border-line bg-canvas pl-10 pr-3 text-small placeholder:text-ink-muted/80 focus:border-brand focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand/15"
        {...rest}
      />
    </div>
  )
}

export function WalletChip({ value, to, onClick }: { value: string; to?: string; onClick?: () => void }) {
  const className = 'mr-1 hidden h-11 items-center gap-2.5 rounded-sm border border-line px-3 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft/40 sm:flex'
  const body = (
    <>
      <Coins className="size-5 text-accent" aria-hidden />
      <span className="leading-tight">
        <span className="block text-[11px] text-ink-muted">Wallet</span>
        <span className="tabular block text-small font-semibold">{value}</span>
      </span>
    </>
  )
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

export interface MenuNotification {
  id: string
  title: string
  body?: string
  time?: string
  read?: boolean
  onSelect: () => void
}

export function NotificationsMenu({ items, onMarkAll }: { items: MenuNotification[]; onMarkAll?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  const unread = items.filter((n) => !n.read).length
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-11 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand active:scale-95"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span key={unread} className="absolute right-2.5 top-2.5 size-2.5 animate-check rounded-full border-2 border-surface bg-accent" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] origin-top-right animate-pop rounded-md border border-line bg-surface shadow-float">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-small font-semibold">Notifications</p>
            {onMarkAll && unread > 0 && (
              <button type="button" onClick={onMarkAll} className="link text-caption">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {!items.length && <li className="px-4 py-3 text-small text-ink-muted">No notifications yet.</li>}
            {items.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    n.onSelect()
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="block truncate text-caption text-ink-muted">{n.body}</span>}
                    {n.time && <span className="block text-caption text-ink-muted/80">{n.time}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export function AccountMenu({ initials, name, caption, actions = [], onLogout }: {
  initials: string
  name: string
  caption: string
  actions?: Array<{ label: string; icon: ReactNode; onClick: () => void }>
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)} className="flex h-11 items-center gap-1.5 rounded-sm pl-1 pr-2 hover:bg-canvas">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-caption font-semibold text-white">{initials}</span>
        <ChevronDown className="hidden size-4 text-ink-muted sm:block" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-60 origin-top-right animate-pop rounded-md border border-line bg-surface p-1.5 shadow-float">
          <div className="px-3 py-2">
            <p className="text-small font-semibold">{name}</p>
            <p className="text-caption text-ink-muted">{caption}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          {[...actions, { label: 'Log out', icon: <LogOut className="size-4" />, onClick: onLogout }].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setOpen(false)
                action.onClick()
              }}
              className="flex h-10 w-full items-center gap-2.5 rounded-sm px-3 text-small text-ink hover:bg-canvas"
            >
              <span className="text-ink-muted" aria-hidden>{action.icon}</span> {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Shell ---------- */

const tabClass = (active: boolean) =>
  cn('group flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 active:scale-95', active ? 'text-brand' : 'text-ink-muted')

function TabBody({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <>
      <span className={cn('inline-flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out', active ? 'scale-100 bg-brand-soft' : 'scale-90 bg-transparent')} aria-hidden>
        {item.icon}
      </span>
      {item.label}
    </>
  )
}

export default function AppShell({ home, nav, footerNav, note, tabs, search, tools, pageKey, children }: {
  home: string
  nav: NavItem[]
  footerNav?: NavItem[]
  /** Short line under the sidebar navigation. */
  note?: ReactNode
  /** Mobile bottom navigation, four items at most. */
  tabs: NavItem[]
  search?: InputHTMLAttributes<HTMLInputElement>
  tools: ReactNode
  /** Content re-enters and the drawer closes when this changes. Defaults to the pathname. */
  pageKey?: string
  children: ReactNode
}) {
  const [drawer, setDrawer] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const page = pageKey ?? pathname

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setDrawer(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only z-50 rounded-sm bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col overflow-y-auto border-r border-line bg-surface px-4 pb-5 pt-5 lg:flex">
        <Logo home={home} className="mb-7 ml-2 self-start" />
        <SidebarBody nav={nav} footerNav={footerNav} note={note} />
      </aside>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-40 transition-[visibility] duration-300 lg:hidden', drawer ? 'visible' : 'invisible')} aria-hidden={!drawer}>
        <div onClick={() => setDrawer(false)} className={cn('absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out', drawer ? 'opacity-100' : 'opacity-0')} />
        <aside
          className={cn('absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto bg-surface px-4 pb-5 pt-4 shadow-float transition-transform duration-300 ease-drawer', drawer ? 'translate-x-0' : '-translate-x-full')}
          aria-label="Menu"
        >
          <div className="mb-6 flex items-center justify-between">
            <Logo home={home} className="ml-2" />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-sm text-ink-muted hover:bg-canvas">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <SidebarBody nav={nav} footerNav={footerNav} note={note} onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="lg:pl-sidebar">
        {/* Top bar */}
        <header className={cn('material sticky top-0 z-20 border-b transition-[border-color,box-shadow] duration-200 ease-out', scrolled ? 'border-line/80 shadow-[0_6px_20px_-12px_rgba(23,21,43,0.18)]' : 'border-transparent')}>
          <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-4 md:px-8">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} className="-ml-2 inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-canvas lg:hidden">
              <Menu className="size-5" aria-hidden />
            </button>
            <Logo home={home} className="lg:hidden" />
            {search && <SearchInput {...search} className="ml-auto hidden w-full max-w-sm md:block lg:ml-0" />}
            <div className="ml-auto flex items-center gap-1">{tools}</div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 pb-28 pt-6 outline-none md:px-8 md:pt-8 lg:pb-16">
          <div key={page} className="animate-rise">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation (Board 01B mobile shell) */}
      <nav aria-label="Quick" className="material fixed inset-x-0 bottom-0 z-30 border-t border-line/70 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-md auto-cols-fr grid-flow-col">
          {tabs.map((item) => {
            const forced = item.match?.(pathname)
            return (
              <li key={item.label}>
                {item.to ? (
                  <NavLink to={item.to} end={item.end} onClick={item.onClick} className={({ isActive }) => tabClass(forced ?? isActive)}>
                    {({ isActive }) => <TabBody item={item} active={forced ?? isActive} />}
                  </NavLink>
                ) : (
                  <button type="button" onClick={item.onClick} className={tabClass(Boolean(forced))}>
                    <TabBody item={item} active={Boolean(forced)} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
