import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  Coins,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Settings,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { formatSim, timeAgo } from '../lib/format'
import { useStore } from '../services/store'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  badge?: number
  /** Custom active test, for sections whose child routes overlap another item. */
  match?: (path: string) => boolean
}

function useNav(): NavItem[] {
  const { contracts } = useStore()
  const reviews = contracts.flatMap((c) => c.milestones).filter((m) => m.status === 'under_review').length
  return [
    { to: '/client', label: 'Dashboard', icon: <LayoutDashboard className="size-5" />, match: (p) => p === '/client' || p === '/client/dashboard' },
    { to: '/client/projects/new', label: 'Create Project', icon: <Plus className="size-5" /> },
    { to: '/client/projects', label: 'My Projects', icon: <FolderKanban className="size-5" />, badge: reviews || undefined, match: (p) => p.startsWith('/client/projects') && !p.startsWith('/client/projects/new') },
    { to: '/client/talent', label: 'Find Freelancers', icon: <Sparkles className="size-5" /> },
    { to: '/client/contracts', label: 'Contracts', icon: <FileText className="size-5" /> },
    { to: '/client/messages', label: 'Messages', icon: <MessageSquare className="size-5" />, badge: 3 },
    { to: '/client/wallet', label: 'Wallet', icon: <Wallet className="size-5" /> },
    { to: '/client/disputes', label: 'Disputes', icon: <Scale className="size-5" /> },
  ]
}

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/client" aria-label="Gigly — dashboard" className={cn('inline-flex rounded-sm', className)}>
      <img src="/brand/gigly-logo.png" alt="Gigly" width={480} height={200} className="h-9 w-auto" />
    </Link>
  )
}

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const { pathname } = useLocation()
  const forced = item.match?.(pathname)
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex h-11 items-center gap-3 rounded-sm px-3 text-small font-medium transition-colors duration-150',
          (forced ?? isActive) ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-canvas hover:text-ink',
        )
      }
    >
      <span className="shrink-0 transition-transform duration-200 ease-out group-active:scale-90" aria-hidden>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge ? <span className="tabular inline-flex size-5 items-center justify-center rounded-full bg-accent text-caption font-bold text-ink">{item.badge}</span> : null}
    </NavLink>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  return (
    <>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => (
          <SideLink key={item.to} item={item} onClick={onNavigate} />
        ))}
      </nav>
      <div className="mt-6 flex flex-col gap-0.5 border-t border-line pt-4">
        <SideLink item={{ to: '/client/help', label: 'Help & Support', icon: <HelpCircle className="size-5" /> }} onClick={onNavigate} />
        <SideLink item={{ to: '/client/settings', label: 'Settings', icon: <Settings className="size-5" /> }} onClick={onNavigate} />
      </div>
    </>
  )
}

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

function Notifications() {
  const { notifications, markAllRead } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  const unread = notifications.filter((n) => !n.read).length
  const navigate = useNavigate()
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
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="link text-caption">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    navigate(n.href)
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="block truncate text-caption text-ink-muted">{n.body}</span>}
                    <span className="block text-caption text-ink-muted/80">{timeAgo(n.at)}</span>
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

function AccountMenu({ onLogout }: { onLogout: () => void }) {
  const { user, resetDemo } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  const navigate = useNavigate()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)} className="flex h-11 items-center gap-1.5 rounded-sm pl-1 pr-2 hover:bg-canvas">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-caption font-semibold text-white">{user.initials}</span>
        <ChevronDown className="hidden size-4 text-ink-muted sm:block" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-60 origin-top-right animate-pop rounded-md border border-line bg-surface p-1.5 shadow-float">
          <div className="px-3 py-2">
            <p className="text-small font-semibold">{user.firstName}</p>
            <p className="text-caption text-ink-muted">Client · {user.company}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              resetDemo()
              setOpen(false)
              navigate('/client')
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-sm px-3 text-small text-ink hover:bg-canvas"
          >
            <RotateCcw className="size-4 text-ink-muted" aria-hidden /> Reset demo data
          </button>
          <button type="button" onClick={onLogout} className="flex h-10 w-full items-center gap-2.5 rounded-sm px-3 text-small text-ink hover:bg-canvas">
            <LogOut className="size-4 text-ink-muted" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

const MOBILE_TABS = [
  { to: '/client', label: 'Home', icon: Home, end: true },
  { to: '/client/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/client/messages', label: 'Messages', icon: MessageSquare, end: false },
  { to: '/client/wallet', label: 'Wallet', icon: Wallet, end: false },
]

export default function ClientShell({ onLogout }: { onLogout: () => void }) {
  const { wallet } = useStore()
  const [drawer, setDrawer] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface px-4 pb-5 pt-5 lg:flex">
        <Logo className="mb-7 ml-2" />
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div onClick={() => setDrawer(false)} className={cn('absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out', drawer ? 'opacity-100' : 'opacity-0')} />
        <aside
          className={cn('absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-surface px-4 pb-5 pt-4 shadow-float transition-transform duration-300 ease-drawer', drawer ? 'translate-x-0' : '-translate-x-full')}
          aria-label="Menu"
        >
          <div className="mb-6 flex items-center justify-between">
            <Logo className="ml-2" />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-sm text-ink-muted hover:bg-canvas">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <SidebarBody onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="lg:pl-sidebar">
        {/* Top bar */}
        <header className={cn('material sticky top-0 z-20 border-b transition-[border-color,box-shadow] duration-200 ease-out', scrolled ? 'border-line/80 shadow-[0_6px_20px_-12px_rgba(23,21,43,0.18)]' : 'border-transparent')}>
          <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-4 md:px-8">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} className="-ml-2 inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-canvas lg:hidden">
              <Menu className="size-5" aria-hidden />
            </button>
            <Logo className="lg:hidden" />
            <div className="relative ml-auto hidden w-full max-w-sm md:block lg:ml-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                type="search"
                aria-label="Search projects and contracts"
                placeholder="Search projects, contracts…"
                className="h-11 w-full rounded-sm border border-line bg-canvas pl-10 pr-3 text-small placeholder:text-ink-muted/80 focus:border-brand focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand/15"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/client/wallet" className="mr-1 hidden h-11 items-center gap-2.5 rounded-sm border border-line px-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/40 sm:flex">
                <Coins className="size-5 text-accent" aria-hidden />
                <span className="leading-tight">
                  <span className="block text-[11px] text-ink-muted">Wallet</span>
                  <span className="tabular block text-small font-semibold">{formatSim(wallet.balance)}</span>
                </span>
              </Link>
              <Notifications />
              <AccountMenu onLogout={onLogout} />
            </div>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-content px-4 pb-28 pt-6 outline-none md:px-8 md:pt-8 lg:pb-16">
          <div key={pathname} className="animate-rise">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation (Board 01B mobile shell) */}
      <nav aria-label="Quick" className="material fixed inset-x-0 bottom-0 z-30 border-t border-line/70 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => cn('group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 active:scale-95', isActive ? 'text-brand' : 'text-ink-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cn('inline-flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out', isActive ? 'scale-100 bg-brand-soft' : 'scale-90 bg-transparent')}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
