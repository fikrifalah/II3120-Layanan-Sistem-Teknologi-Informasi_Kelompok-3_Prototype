import { useState } from 'react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Feedback'
import { Textarea } from './ui/Field'
import { demoRecipient, sendDemoMessage, useDemoWorkspace } from '../services/demoWorkspace'

export default function InvitationMessages({ id, sender, close }: { id: string; sender: 'client' | 'freelancer'; close: () => void }) {
  const workspace = useDemoWorkspace()
  const inv = workspace?.invitations.find(i => i.id === id && i.candidateId === demoRecipient)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Dialog open onClose={close} title="Invitation messages">
    {inv && <><p className="mb-3 font-semibold">{workspace?.projects.find(p => p.id === inv.projectId)?.title}</p>
      <ul className="mb-4 max-h-64 space-y-2 overflow-auto" aria-label="Conversation">{inv.message && <li><b>Client</b><p>{inv.message}</p></li>}
        {inv.conversation?.map((m, i) => <li className="rounded-md bg-canvas p-2" key={i}><b>{m.sender === 'client' ? 'Client' : 'Freelancer'}</b><p className="whitespace-pre-wrap break-words">{m.text}</p></li>)}</ul>
      {['pending','accepted'].includes(inv.status) && <form onSubmit={async e => {
        e.preventDefault()
        if (busy || !text.trim()) return
        setBusy(true); setError('')
        try { await sendDemoMessage(id, sender, text); setText('') } catch { setError('Could not send message. Please retry.') }
        finally { setBusy(false) }
      }}><label className="block">Message<Textarea className="my-2 block" rows={3} required maxLength={2000} value={text} disabled={busy} onChange={e => setText(e.target.value)} /></label>
        {error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy || !text.trim()}>Send message</Button></form>}</>}
  </Dialog>
}
