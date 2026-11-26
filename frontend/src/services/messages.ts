import { useEffect, useState } from 'react'
import { uid } from '../lib/format'
import { currentAccount } from './auth'

export interface DemoMessage {
  id: string
  sender: 'client' | 'freelancer'
  text: string
  at: string
  read: boolean
}

export interface DemoConversation {
  id: string
  freelancer: string
  project: string
  messages: DemoMessage[]
}

const eventName = 'gigly:messages'

function storageKey() {
  const account = currentAccount()
  return `gigly.messages.v1.${account?.id ?? account?.email ?? 'demo'}`
}

function isMessage(value: unknown): value is DemoMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return typeof message.id === 'string'
    && (message.sender === 'client' || message.sender === 'freelancer')
    && typeof message.text === 'string'
    && typeof message.at === 'string'
    && typeof message.read === 'boolean'
}

function isConversation(value: unknown): value is DemoConversation {
  if (!value || typeof value !== 'object') return false
  const conversation = value as Record<string, unknown>
  return typeof conversation.id === 'string'
    && typeof conversation.freelancer === 'string'
    && typeof conversation.project === 'string'
    && Array.isArray(conversation.messages)
    && conversation.messages.every(isMessage)
}

function makeSeed(): DemoConversation[] {
  const now = Date.now()
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
  return [
    {
      id: 'demo-rfi',
      freelancer: 'Rafi Pratama',
      project: 'Backend Microservices & API Integration',
      messages: [
        { id: 'm-rfi-1', sender: 'client', text: 'Can you share an update on the API integration?', at: ago(90), read: true },
        { id: 'm-rfi-2', sender: 'freelancer', text: 'The user service is ready. I am finishing the order endpoints now.', at: ago(15), read: false },
      ],
    },
    {
      id: 'demo-nadia',
      freelancer: 'Nadia Putri',
      project: 'E-commerce Website Development',
      messages: [
        { id: 'm-nadia-1', sender: 'freelancer', text: 'I reviewed the product catalogue requirements. Do you have brand assets ready?', at: ago(42), read: false },
      ],
    },
    {
      id: 'demo-dimas',
      freelancer: 'Dimas Saputra',
      project: 'Sales Analytics Dashboard',
      messages: [
        { id: 'm-dimas-1', sender: 'freelancer', text: 'I can include a regional sales filter in the first dashboard draft.', at: ago(120), read: false },
      ],
    },
  ]
}

function readConversations(): DemoConversation[] {
  const key = storageKey()
  const raw = localStorage.getItem(key)
  if (!raw) {
    const seed = makeSeed()
    localStorage.setItem(key, JSON.stringify(seed))
    return seed
  }
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isConversation)) {
    throw new Error('Saved demo messages are invalid. Reset the demo data to restore them.')
  }
  return parsed
}

function updateConversations(update: (conversations: DemoConversation[]) => DemoConversation[]) {
  localStorage.setItem(storageKey(), JSON.stringify(update(readConversations())))
  window.dispatchEvent(new Event(eventName))
}

export function useDemoMessages() {
  const [conversations, setConversations] = useState(readConversations)

  useEffect(() => {
    const refresh = () => setConversations(readConversations())
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey() || event.key === null) refresh()
    }
    window.addEventListener(eventName, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(eventName, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return conversations
}

export function markConversationRead(id: string) {
  updateConversations((conversations) => conversations.map((conversation) => conversation.id !== id ? conversation : {
    ...conversation,
    messages: conversation.messages.map((message) => message.sender === 'freelancer' ? { ...message, read: true } : message),
  }))
}

export function sendDemoMessage(id: string, text: string) {
  const content = text.trim()
  if (!content || content.length > 2000) throw new Error('Message must be between 1 and 2000 characters.')
  updateConversations((conversations) => conversations.map((conversation) => conversation.id !== id ? conversation : {
    ...conversation,
    messages: [...conversation.messages, {
      id: uid('MSG'),
      sender: 'client',
      text: content,
      at: new Date().toISOString(),
      read: true,
    }],
  }))
}

export function resetDemoMessages() {
  const seed = makeSeed()
  localStorage.setItem(storageKey(), JSON.stringify(seed))
  window.dispatchEvent(new Event(eventName))
}
