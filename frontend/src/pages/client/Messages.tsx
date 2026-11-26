import { useState, type FormEvent } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { PageHeader } from '../../components/ui/Display'
import { usePageTitle } from '../../lib/usePageTitle'
import { markConversationRead, sendDemoMessage, useDemoMessages } from '../../services/messages'

function messageTime(at: string) {
  return new Date(at).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function Messages() {
  usePageTitle('Messages')
  const conversations = useDemoMessages()
  const [selectedId, setSelectedId] = useState<string>()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const selected = conversations.find((conversation) => conversation.id === selectedId)
  const unreadCount = conversations.reduce((total, conversation) =>
    total + conversation.messages.filter((message) => message.sender === 'freelancer' && !message.read).length, 0)

  function openConversation(id: string) {
    setSelectedId(id)
    setError('')
    markConversationRead(id)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !text.trim()) return
    try {
      sendDemoMessage(selected.id, text)
      setText('')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the message.')
    }
  }

  return (
    <div>
      <PageHeader title="Messages" subtitle="Conversations with freelancers on your projects." />
      <p className="mb-4 rounded-sm border border-brand/20 bg-brand-soft/50 px-4 py-3 text-small text-ink-muted">
        Demo inbox: messages are saved in this browser and are not sent to a real person.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.5fr)]">
        <section className="card overflow-hidden p-0" aria-label="Conversations">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Inbox</h2>
            <span className="text-caption text-ink-muted">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span>
          </div>
          <ul>
            {conversations.map((conversation) => {
              const latest = conversation.messages[conversation.messages.length - 1]
              const unread = conversation.messages.filter((message) => message.sender === 'freelancer' && !message.read).length
              return (
                <li key={conversation.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    aria-current={selectedId === conversation.id ? 'true' : undefined}
                    onClick={() => openConversation(conversation.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-canvas ${selectedId === conversation.id ? 'bg-brand-soft/60' : ''}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{conversation.freelancer}</span>
                      {unread > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-bold text-ink">{unread}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-ink-muted">{conversation.project}</span>
                    {latest && <span className="mt-1 block truncate text-small text-ink-muted">{latest.text}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card flex min-h-96 flex-col p-0" aria-label="Selected conversation">
          {selected ? (
            <>
              <header className="border-b border-line px-5 py-4">
                <h2 className="font-semibold">{selected.freelancer}</h2>
                <p className="text-caption text-ink-muted">{selected.project}</p>
              </header>
              <ol className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" aria-label="Messages">
                {selected.messages.map((message) => (
                  <li key={message.id} className={`max-w-[85%] rounded-md px-3 py-2 ${message.sender === 'client' ? 'ml-auto bg-brand text-white' : 'bg-canvas text-ink'}`}>
                    <p className="whitespace-pre-wrap break-words text-small">{message.text}</p>
                    <time className={`mt-1 block text-right text-caption ${message.sender === 'client' ? 'text-white/75' : 'text-ink-muted'}`} dateTime={message.at}>
                      {message.sender === 'client' ? 'You · ' : ''}{messageTime(message.at)}
                    </time>
                  </li>
                ))}
              </ol>
              <form onSubmit={submit} className="border-t border-line p-4">
                <label htmlFor="message-reply" className="sr-only">Write a message</label>
                <div className="flex items-end gap-2">
                  <textarea
                    id="message-reply"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder="Write a reply…"
                    className="min-h-11 flex-1 resize-y rounded-sm border border-line bg-surface px-3 py-2 text-small focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                  />
                  <button type="submit" disabled={!text.trim()} className="inline-flex h-11 items-center gap-2 rounded-sm bg-brand px-3 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    <Send className="size-4" aria-hidden /> Send
                  </button>
                </div>
                {error && <p role="alert" className="mt-2 text-small text-danger">{error}</p>}
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-ink-muted">
              <MessageSquare className="mb-3 size-8" aria-hidden />
              <p className="font-semibold text-ink">Select a conversation</p>
              <p className="mt-1 text-small">Choose a thread to read and reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
