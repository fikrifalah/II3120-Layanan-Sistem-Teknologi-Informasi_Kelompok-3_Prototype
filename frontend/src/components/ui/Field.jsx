import { useId, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cx } from '../../lib/utils.js'

const CONTROL =
  'w-full min-h-12 rounded-input border bg-surface px-4 text-body text-ink placeholder:text-ink-muted ' +
  'transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-page disabled:text-ink-muted'

/** Persistent label, optional helper, inline error. Wires aria-describedby for you. */
function Shell({ id, label, helper, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : (
        helper && (
          <p id={`${id}-helper`} className="text-caption text-ink-muted">
            {helper}
          </p>
        )
      )}
    </div>
  )
}

const describedBy = (id, error, helper) => (error ? `${id}-error` : helper ? `${id}-helper` : undefined)

export function TextField({ label, helper, error, suffix, className, ...input }) {
  const id = useId()
  return (
    <Shell id={id} label={label} helper={helper} error={error}>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helper)}
          className={cx(CONTROL, error ? 'border-danger' : 'border-line', suffix && 'pr-24', className)}
          {...input}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-small font-semibold text-ink-muted">
            {suffix}
          </span>
        )}
      </div>
    </Shell>
  )
}

export function SelectField({ label, helper, error, placeholder, options, value, ...select }) {
  const id = useId()
  return (
    <Shell id={id} label={label} helper={helper} error={error}>
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helper)}
          className={cx(
            CONTROL,
            'appearance-none pr-11',
            error ? 'border-danger' : 'border-line',
            !value && 'text-ink-muted',
          )}
          {...select}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-ink">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </div>
    </Shell>
  )
}

/** Multi-tag input. Enter or comma adds, Backspace on an empty field removes the last tag. */
export function TagField({
  label,
  helper,
  error,
  placeholder,
  value,
  onChange,
  max = 8,
  suggestions = [],
  suggestionsLabel,
  removeLabel,
  maxLabel,
}) {
  const id = useId()
  const inputRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [full, setFull] = useState(false)

  const has = (tag) => value.some((v) => v.toLowerCase() === tag.toLowerCase())

  const add = (raw) => {
    const tag = raw.trim().replace(/,$/, '').trim()
    if (!tag || has(tag)) return setDraft('')
    if (value.length >= max) {
      setFull(true)
      return setDraft('')
    }
    setFull(false)
    onChange([...value, tag])
    setDraft('')
  }

  const remove = (tag) => {
    setFull(false)
    onChange(value.filter((v) => v !== tag))
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const open = suggestions.filter((s) => !has(s))

  return (
    <Shell id={id} label={label} helper={full ? maxLabel : helper} error={error}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cx(
          'flex min-h-12 w-full cursor-text flex-wrap items-center gap-2 rounded-input border bg-surface px-3 py-2',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25',
          error ? 'border-danger' : 'border-line',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary-subtle py-1 pl-3 pr-1 text-caption text-primary-hover"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={removeLabel.replace('{name}', tag)}
              className="grid size-6 place-items-center rounded-full transition-colors duration-150 [@media(hover:hover)]:hover:bg-primary/15"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helper)}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-body text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={suggestionsLabel}>
          <span className="text-caption text-ink-muted">{suggestionsLabel}</span>
          {open.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-line bg-page px-3 py-1 text-caption text-ink transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:border-primary [@media(hover:hover)]:hover:bg-primary-subtle"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </Shell>
  )
}
