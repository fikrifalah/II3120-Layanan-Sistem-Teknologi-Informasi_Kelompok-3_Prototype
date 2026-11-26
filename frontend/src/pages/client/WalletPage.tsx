import { ArrowDownLeft, ArrowUpRight, Coins, Hexagon, Info, Lock, Plus, RotateCcw, Wallet } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatDateTime, formatSim, shortHash } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { TxType } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageHeader, StatCard } from '../../components/ui/Display'
import { useToast } from '../../components/ui/Feedback'
import { CopyButton } from './FundEscrow'

const TX: Record<TxType, { label: string; icon: typeof Coins; out: boolean }> = {
  fund: { label: 'Escrow lock', icon: Lock, out: true },
  release: { label: 'Release', icon: ArrowUpRight, out: true },
  refund: { label: 'Refund', icon: RotateCcw, out: false },
  faucet: { label: 'Deposit', icon: ArrowDownLeft, out: false },
}

export default function WalletPage() {
  usePageTitle('Wallet')
  const { wallet, transactions, addDemoTokens, getProject } = useStore()
  const toast = useToast()

  return (
    <div>
      <PageHeader
        title="Wallet"
        subtitle="Your SIM-IDR balance, funds locked in escrow and every on-chain transaction."
        actions={
          <Button
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() =>
              addDemoTokens().then(
                () => toast({ tone: 'success', title: '20,000 SIM-IDR added', body: 'Demo tokens on the local network.' }),
                (e) => toast({ tone: 'danger', title: e instanceof Error ? e.message : 'Unable to add demo tokens.' }),
              )
            }
          >
            Get demo tokens
          </Button>
        }
      />

      <div className="card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-ink text-white">
          <Wallet className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">Connected wallet</p>
          <p className="flex items-center font-mono text-small">
            <span className="truncate">{wallet.address}</span>
            <CopyButton value={wallet.address} label="Wallet address" />
          </p>
        </div>
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 text-small font-semibold">
          <Hexagon className="size-4 fill-accent text-accent" aria-hidden /> {wallet.network}
        </span>
      </div>

      <section aria-label="Balances" className="stagger grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard icon={<Coins className="size-5" />} label="Available" value={formatSim(wallet.balance)} />
        <StatCard icon={<Lock className="size-5" />} label="Locked in escrow" value={formatSim(wallet.locked)} tone="accent" />
        <StatCard icon={<ArrowUpRight className="size-5" />} label="Total paid out" value={formatSim(wallet.spent)} tone="success" />
        <StatCard icon={<RotateCcw className="size-5" />} label="Refunds" value={formatSim(wallet.refunded)} />
      </section>

      <p className="mt-4 flex items-center gap-2 text-small text-ink-muted">
        <Info className="size-4 text-brand" aria-hidden />
        <span>
          <strong className="font-semibold text-ink">SIM-IDR</strong> — simulation token, no real monetary value.
        </span>
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-h2">Transactions</h2>
        <div className="card overflow-hidden">
          <ul className="stagger divide-y divide-line">
            {transactions.map((t) => {
              const meta = TX[t.type]
              const Icon = meta.icon
              const project = getProject(t.projectId)
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-md', meta.out ? 'bg-brand-soft text-brand' : 'bg-success-soft text-success')}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-semibold">{t.label}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {meta.label}
                      {project && ` · ${project.title}`} · <span className="font-mono">{shortHash(t.hash)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('tabular text-small font-semibold', meta.out ? 'text-ink' : 'text-success')}>
                      {meta.out ? '−' : '+'}
                      {formatSim(t.amount)}
                    </p>
                    <p className="text-caption text-ink-muted">{formatDateTime(t.at)}</p>
                  </div>
                  <Badge tone={t.status === 'confirmed' ? 'success' : t.status === 'pending' ? 'warning' : 'danger'} className="hidden sm:inline-flex">
                    {t.status === 'confirmed' ? 'Confirmed' : t.status === 'pending' ? 'Pending' : 'Failed'}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
