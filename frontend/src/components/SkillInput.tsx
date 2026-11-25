import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '../lib/cn'

/** Tag input for skills: type and press Enter or comma, or pick a suggestion. */
export function SkillInput({
  value,
  onChange,
  suggestions,
  exclude = [],
  invalid,
  id,
  describedBy,
  placeholder = 'Type a skill and press Enter',
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  exclude?: string[]
  invalid?: boolean
  id?: string
  describedBy?: string
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const lower = value.map((v) => v.toLowerCase())
  const taken = [...lower, ...exclude.map((e) => e.toLowerCase())]

  const add = (raw: string) => {
    const s = raw.trim().replace(/,$/, '')
    if (!s || taken.includes(s.toLowerCase())) return setText('')
    onChange([...value, s])
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(text)
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const open = suggestions.filter((s) => !taken.includes(s.toLowerCase()) && (!text || s.toLowerCase().includes(text.toLowerCase()))).slice(0, 8)

  return (
    <div>
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15',
          invalid ? 'border-danger' : 'border-line',
        )}
      >
        {value.map((s) => (
          <span key={s} className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-soft pl-3 pr-1 text-caption font-semibold text-brand">
            {s}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== s))} aria-label={`Remove ${s}`} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-brand hover:text-white">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => text && add(text)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          placeholder={value.length ? '' : placeholder}
          className="h-8 min-w-[10rem] flex-1 bg-transparent px-1.5 text-small outline-none placeholder:text-ink-muted/70"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-caption font-medium text-ink-muted transition-[border-color,color,transform] duration-150 hover:border-brand/50 hover:text-brand active:scale-95"
            >
              <Plus className="size-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
