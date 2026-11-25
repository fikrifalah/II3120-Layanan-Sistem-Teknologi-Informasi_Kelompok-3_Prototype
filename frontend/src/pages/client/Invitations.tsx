import { useState } from 'react'
import InvitationMessages from '../../components/InvitationMessages'
import { demoRecipient } from '../../services/demoWorkspace'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Clock, FileSignature, MessageSquare, Send, Sparkles, X } from 'lucide-react'
import { useStore } from '../../services/store'
import { timeAgo } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { Button, LinkButton } from '../../components/ui/Button'
import { InvitationStatusBadge } from '../../components/ui/Badge'
import { Breadcrumb, EmptyState, PageHeader } from '../../components/ui/Display'
import { Alert } from '../../components/ui/Feedback'
import { AnonAvatar, PersonAvatar, ScoreRing } from '../../components/ui/Identity'

export default function Invitations() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const [thread, setThread] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const project = store.getProject(projectId)
  usePageTitle('Invitations')
  if (!project) return <Navigate to="/client/projects" replace />

  const invs = store.invitations.filter((i) => i.projectId === projectId)
  const contract = store.contracts.find((c) => c.projectId === projectId)
  const pending = invs.filter((i) => i.status === 'pending').length

  const startContract = (candidateId: string) => {
    store.createContract(projectId, candidateId)
    navigate(`/client/projects/${projectId}/contract`)
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'My Projects', to: '/client/projects' }, { label: project.title, to: `/client/projects/${projectId}` }, { label: 'Invitations' }]} />
      <PageHeader
        title="Invitations"
        subtitle={project.title}
        actions={
          <LinkButton to={`/client/projects/${projectId}/matches`} variant="secondary" icon={<Sparkles className="size-4" aria-hidden />}>
            Back to matches
          </LinkButton>
        }
      />

      {thread && <InvitationMessages id={thread} sender="client" close={() => setThread('')} />}
      {error && <Alert tone="danger">{error}</Alert>}
      {pending > 0 && (
        <Alert tone="info" title={`${pending} ${pending === 1 ? 'invitation is' : 'invitations are'} waiting for a reply`} className="mb-5">
          Freelancers see your project brief. You will be notified when they answer, and their identity is revealed if they accept.
        </Alert>
      )}

      {invs.length === 0 ? (
        <EmptyState
          icon={<Send className="size-6" />}
          title="No invitations yet"
          body="Pick one or more anonymous candidates from your matches and invite them to discuss the project."
          action={<LinkButton to={`/client/projects/${projectId}/matches`}>See matches</LinkButton>}
        />
      ) : (
        <ul className="stagger space-y-3">
          {invs.map((inv) => {
            const c = inv.candidateSnapshot ?? store.getCandidate(projectId, inv.candidateId)
            if (!c) return null
            const accepted = inv.status === 'accepted'
            const isHired = contract?.candidateId === c.id
            return (
              <li key={inv.id} className="card grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
                <div className="flex min-w-0 items-center gap-4">
                  {accepted ? <PersonAvatar initials={c.identity.initials} size={52} /> : <AnonAvatar seed={c.id} size={52} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-semibold text-ink">{accepted ? c.identity.name : `Candidate ${c.id}`}</p>
                      <InvitationStatusBadge status={inv.status} />
                    </div>
                    <p className="text-small text-ink-muted">
                      {accepted ? `${c.identity.role} · ${c.identity.location} · was ${c.id}` : c.headline}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-muted">
                      <Clock className="size-3.5" aria-hidden /> Sent {timeAgo(inv.sentAt)}
                      {inv.respondedAt && ` · answered ${timeAgo(inv.respondedAt)}`}
                    </p>
                  </div>
                  <ScoreRing score={c.score} size={48} />
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {inv.candidateId === demoRecipient && <Button variant="quiet" onClick={() => setThread(inv.id)}>Messages</Button>}
                  {inv.status === 'pending' && (
                    <Button variant="quiet" icon={<X className="size-4" aria-hidden />} onClick={() => { setError(''); store.cancelInvitation(inv.id).catch(e => setError(e.message)) }}>
                      Cancel invitation
                    </Button>
                  )}
                  {accepted && (
                    <>
                      {inv.candidateId !== demoRecipient && <LinkButton to="/client/messages" variant="quiet" icon={<MessageSquare className="size-4" aria-hidden />}>
                        Message
                      </LinkButton>}
                      {isHired ? (
                        <LinkButton to={contract.status === 'awaiting_funding' ? `/client/projects/${projectId}/fund` : contract.status === 'active' ? `/client/projects/${projectId}` : `/client/projects/${projectId}/contract`}>
                          Open contract
                        </LinkButton>
                      ) : !contract ? (
                        <Button icon={<FileSignature className="size-4" aria-hidden />} onClick={() => startContract(c.id)}>
                          Create contract
                        </Button>
                      ) : null}
                    </>
                  )}
                  {inv.status === 'declined' && (
                    <LinkButton to={`/client/projects/${projectId}/matches`} variant="secondary">
                      Choose another
                    </LinkButton>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
