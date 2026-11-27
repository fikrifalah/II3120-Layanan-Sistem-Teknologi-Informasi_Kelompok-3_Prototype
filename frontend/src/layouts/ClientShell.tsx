import { Outlet, useNavigate } from 'react-router-dom'
import {
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  LayoutDashboard,
  MessageSquare,
  Plus,
  RotateCcw,
  Scale,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { formatSim, timeAgo } from '../lib/format'
import { resetDemoMessages, useDemoMessages } from '../services/messages'
import { useStore } from '../services/store'
import AppShell, { AccountMenu, NotificationsMenu, WalletChip, type NavItem } from './AppShell'

export default function ClientShell({ onLogout }: { onLogout: () => void }) {
  const { user, wallet, contracts, notifications, markAllRead, resetDemo } = useStore()
  const conversations = useDemoMessages()
  const navigate = useNavigate()
  const reviews = contracts.flatMap((c) => c.milestones).filter((m) => m.status === 'under_review').length
  const unreadMessages = conversations.reduce((total, conversation) =>
    total + conversation.messages.filter((message) => message.sender === 'freelancer' && !message.read).length, 0)

  const nav: NavItem[] = [
    { to: '/client', label: 'Dashboard', icon: <LayoutDashboard className="size-5" />, match: (p) => p === '/client' || p === '/client/dashboard' },
    { to: '/client/projects/new', label: 'Create Project', icon: <Plus className="size-5" /> },
    { to: '/client/projects', label: 'My Projects', icon: <FolderKanban className="size-5" />, badge: reviews || undefined, match: (p) => p.startsWith('/client/projects') && !p.startsWith('/client/projects/new') },
    { to: '/client/talent', label: 'Find Freelancers', icon: <Sparkles className="size-5" /> },
    { to: '/client/contracts', label: 'Contracts', icon: <FileText className="size-5" /> },
    { to: '/client/messages', label: 'Messages', icon: <MessageSquare className="size-5" />, badge: unreadMessages || undefined },
    { to: '/client/wallet', label: 'Wallet', icon: <Wallet className="size-5" /> },
    { to: '/client/disputes', label: 'Disputes', icon: <Scale className="size-5" /> },
  ]

  return (
    <AppShell
      home="/client"
      nav={nav}
      footerNav={[
        { to: '/client/help', label: 'Help & Support', icon: <HelpCircle className="size-5" /> },
        { to: '/client/settings', label: 'Settings', icon: <Settings className="size-5" /> },
      ]}
      tabs={[
        { to: '/client', label: 'Home', icon: <Home className="size-5" />, end: true },
        { to: '/client/projects', label: 'Projects', icon: <FolderKanban className="size-5" /> },
        { to: '/client/messages', label: 'Messages', icon: <MessageSquare className="size-5" /> },
        { to: '/client/wallet', label: 'Wallet', icon: <Wallet className="size-5" /> },
      ]}
      search={{ 'aria-label': 'Search projects and contracts', placeholder: 'Search projects, contracts…' }}
      tools={
        <>
          <WalletChip to="/client/wallet" value={formatSim(wallet.balance)} />
          <NotificationsMenu
            onMarkAll={markAllRead}
            items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, time: timeAgo(n.at), read: n.read, onSelect: () => navigate(n.href) }))}
          />
          <AccountMenu
            initials={user.initials}
            name={user.firstName}
            caption={`Client · ${user.company}`}
            actions={[
              {
                label: 'Reset demo data',
                icon: <RotateCcw className="size-4" />,
                onClick: () => {
                  resetDemo()
                  resetDemoMessages()
                  navigate('/client')
                },
              },
            ]}
            onLogout={onLogout}
          />
        </>
      }
    >
      <Outlet />
    </AppShell>
  )
}
