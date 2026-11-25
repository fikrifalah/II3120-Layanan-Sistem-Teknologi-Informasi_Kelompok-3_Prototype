import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Copy, Hexagon, Info, Loader2, Lock, RotateCcw, Wallet, XCircle } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatSim, shortHash } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import type { Transaction } from '../../types/domain'
import { Button, LinkButton } from '../../components/ui/Button'
import { Breadcrumb, CardTitle, KeyValue, PageHeader } from '../../components/ui/Display'
import { Alert, useToast } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/ui/Identity'

type Phase = 'idle' | 'pending' | 'confirmed' | 'failed'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast()
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        toast({ tone: 'success', title: `${label} copied` })
      }}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand active:scale-95"
    >
      <Copy className="size-4" aria-hidden />
    </button>
  )
}

export default function FundEscrow() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const project = store.getProject(projectId)
  const contract = store.contracts.find((c) => c.projectId === projectId)
  const [phase, setPhase] = useState<Phase>(contract?.status === 'active' ? 'confirmed' : 'idle')
  const [tx, setTx] = useState<Transaction | null>(null)
  usePageTitle('Fund escrow')

  if (!project || !contract) return <Navigate to="/client/projects" replace />
  if (contract.status === 'draft' || contract.status === 'pending_approval') return <Navigate to={`/client/projects/${projectId}/contract`} replace />

  const c = store.getCandidate(projectId, contract.candidateId)
  const total = contract.milestones.reduce((n, m) => n + m.amount, 0)
  const short = store.wallet.balance < total && phase !== 'confirmed'

  const fund = async () => {
    setPhase('pending')
    try {
      setTx(await store.fundContract(contract.id))
      setPhase('confirmed')
    } catch {
      setPhase('failed')
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Contracts', to: '/client/contracts' }, { label: project.title, to: `/client/projects/${projectId}/contract` }, { label: 'Fund escrow' }]} />
      <PageHeader title="Fund escrow" subtitle="Lock the full contract value to activate the contract. Work starts once the network confirms it." />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <CardTitle>Contract summary</CardTitle>
          <p className="font-semibold">{project.title}</p>
          {c && (
            <div className="mt-3 flex items-center gap-3">
              <PersonAvatar initials={c.identity.initials} size={40} />
              <div>
                <p className="text-small font-semibold">{c.identity.name}</p>
                <p className="text-caption text-ink-muted">{c.identity.role}</p>
              </div>
            </div>
          )}
          <dl className="mt-4 divide-y divide-line border-t border-line">
            <KeyValue label="Contract value">{formatSim(total)}</KeyValue>
            <KeyValue label="Milestones">{contract.milestones.length}</KeyValue>
            <KeyValue label="Review period">{contract.reviewDays} days</KeyValue>
            <KeyValue label="Approved by">Both parties · v{contract.version}</KeyValue>
          </dl>
        </section>

        <section className="card p-5">
          <CardTitle>Wallet & network</CardTitle>
          <div className="flex h-11 items-center gap-2.5 rounded-sm border border-line px-3 text-small font-semibold">
            <Hexagon className="size-5 fill-accent text-accent" aria-hidden /> {store.wallet.network}
            <span className="ml-auto inline-flex items-center gap-1.5 text-caption font-medium text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden /> Connected
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-sm border border-line p-3">
            <Wallet className="size-5 text-brand" aria-hidden />
            <div>
              <p className="text-caption text-ink-muted">Available balance</p>
              <p className="tabular text-h3">{formatSim(store.wallet.balance)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-sm border border-line p-3">
            <div className="min-w-0 flex-1">
              <p className="text-caption text-ink-muted">Client wallet address</p>
              <p className="tabular truncate font-mono text-small">{shortHash(store.wallet.address)}</p>
            </div>
            <CopyButton value={store.wallet.address} label="Wallet address" />
          </div>
        </section>

        <section className="card flex flex-col p-5">
          <CardTitle>Funding breakdown</CardTitle>
          <ul className="space-y-2">
            {contract.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-small">
                <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-[6px] bg-brand-soft px-1.5 text-caption font-bold text-brand">M{m.seq}</span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="tabular font-semibold">{formatSim(m.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-md bg-accent-soft px-4 py-3">
            <span className="font-semibold">Total to lock</span>
            <span className="tabular text-h3">{formatSim(total)}</span>
          </div>
          <p className="mt-3 flex gap-2 text-caption text-ink-muted">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            SIM-IDR is a simulation token with no real monetary value.
          </p>
          <div className="mt-auto pt-5">
            {phase === 'confirmed' ? (
              <LinkButton to={`/client/projects/${projectId}`} block>
                Open project workspace
              </LinkButton>
            ) : short ? (
              <Button block variant="secondary" onClick={store.addDemoTokens}>
                Get 20,000 demo tokens
              </Button>
            ) : (
              <Button block icon={<Lock className="size-4" aria-hidden />} loading={phase === 'pending'} onClick={fund}>
                {phase === 'pending' ? 'Waiting for confirmation' : 'Fund & activate contract'}
              </Button>
            )}
          </div>
        </section>
      </div>

      {short && (
        <Alert tone="warning" title="Not enough SIM-IDR" className="mt-5">
          You need {formatSim(total - store.wallet.balance)} more. Demo tokens are free on the local network.
        </Alert>
      )}

      {phase === 'idle' && !short && (
        <Alert tone="warning" title="All milestone funds are locked at once before work starts" className="mt-5">
          The contract becomes active only after the funding transaction is confirmed. Funds are released milestone by milestone when you approve — Gigly never holds them.
        </Alert>
      )}

      <div aria-live="polite" className="mt-5">
        {phase === 'pending' && (
          <div className="card flex items-start gap-4 border-accent/40 bg-accent-soft/50 p-5">
            <Loader2 className="mt-0.5 size-6 shrink-0 animate-spin text-accent-strong" aria-hidden />
            <div>
              <p className="font-semibold">Transaction submitted</p>
              <p className="text-small text-ink-muted">Your funding transaction is waiting for confirmation on {store.wallet.network}. Do not close this page.</p>
            </div>
          </div>
        )}
        {phase === 'confirmed' && (
          <div className="card border-success/30 bg-success-soft/50 p-5">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Funding confirmed — the contract is active</p>
                <p className="text-small text-ink-muted">{c?.identity.name ?? 'The freelancer'} has been told the funds are secured and can start Milestone 1.</p>
                <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                  {(tx?.hash ?? contract.fundingTxHash) && (
                    <KeyValue label="Transaction hash">
                      <span className="inline-flex items-center gap-1 font-mono">
                        {shortHash(tx?.hash ?? contract.fundingTxHash!)} <CopyButton value={tx?.hash ?? contract.fundingTxHash!} label="Transaction hash" />
                      </span>
                    </KeyValue>
                  )}
                  {contract.escrowAddress && (
                    <KeyValue label="Escrow contract">
                      <span className="font-mono">{shortHash(contract.escrowAddress)}</span>
                    </KeyValue>
                  )}
                  <KeyValue label="Locked amount">{formatSim(total)}</KeyValue>
                  {contract.documentHash && (
                    <KeyValue label="Agreement hash">
                      <span className="font-mono">{shortHash(contract.documentHash)}</span>
                    </KeyValue>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}
        {phase === 'failed' && (
          <div className="card flex items-start gap-4 border-danger/30 bg-danger-soft/60 p-5">
            <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Funding transaction failed</p>
              <p className="text-small text-ink-muted">The transaction was not confirmed, so no funds moved. Check your wallet and try again.</p>
            </div>
            <Button variant="danger" size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={fund}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <p className="mt-4 flex items-center gap-2 text-caption text-ink-muted">
          <AlertTriangle className="size-3.5" aria-hidden /> Network fees are simulated on the local network.
        </p>
      )}
    </div>
  )
}
