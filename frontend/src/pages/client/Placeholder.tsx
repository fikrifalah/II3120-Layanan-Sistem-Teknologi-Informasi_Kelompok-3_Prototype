import { HelpCircle, Settings } from 'lucide-react'
import { usePageTitle } from '../../lib/usePageTitle'
import { LinkButton } from '../../components/ui/Button'
import { EmptyState, PageHeader } from '../../components/ui/Display'

const COPY = {
  settings: { title: 'Settings', icon: <Settings className="size-6" />, body: 'Account, security and wallet settings are not part of this prototype yet.' },
  help: { title: 'Help & Support', icon: <HelpCircle className="size-6" />, body: 'Guides on matching, contracts and escrow will live here.' },
}

export default function Placeholder({ kind }: { kind: keyof typeof COPY }) {
  const c = COPY[kind]
  usePageTitle(c.title)
  return (
    <div>
      <PageHeader title={c.title} />
      <EmptyState icon={c.icon} title="Not built yet" body={c.body} action={<LinkButton to="/client" variant="secondary">Back to dashboard</LinkButton>} />
    </div>
  )
}
