import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

const control =
  'w-full rounded-sm border bg-surface px-3.5 text-small text-ink placeholder:text-ink-muted/70 transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:bg-disabled-bg disabled:text-disabled-text'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
  aside?: ReactNode
}

/** Board 01A: labels stay visible above the control; hint below; error replaces the hint, in red with an icon. */
export function Field({ label, hint, error, required, children, className, aside }: FieldProps) {
  const id = useId()
  const descId = hint || error ? `${id}-desc` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </label>
        {aside}
      </div>
      {children({ id, describedBy: descId, invalid: Boolean(error) })}
      {error ? (
        <p id={descId} className="flex items-center gap-1.5 text-caption font-medium text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; suffix?: ReactNode; prefixIcon?: ReactNode }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, suffix, prefixIcon, className, ...rest }, ref) {
  return (
    <div className="relative flex items-center">
      {prefixIcon && <span className="pointer-events-none absolute left-3.5 text-ink-muted">{prefixIcon}</span>}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'h-11', invalid ? 'border-danger' : 'border-line hover:border-line-control/60', prefixIcon && 'pl-10', suffix && 'pr-16', className)}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-1.5 rounded-[6px] bg-canvas px-2.5 py-1.5 text-caption font-semibold text-ink-muted">{suffix}</span>}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { invalid, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(control, 'resize-y py-2.5 leading-6', invalid ? 'border-danger' : 'border-line hover:border-line-control/60', className)}
      {...rest}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'h-11 cursor-pointer appearance-none pr-10', invalid ? 'border-danger' : 'border-line hover:border-line-control/60', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  )
})

export function Checkbox({ checked, onChange, label, hint, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; id?: string }) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <label htmlFor={cid} className="group flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input
        id={cid}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[5px] border-line-control accent-brand"
      />
      <span className="flex flex-col">
        <span className="text-small font-medium text-ink">{label}</span>
        {hint && <span className="text-caption text-ink-muted">{hint}</span>}
      </span>
    </label>
  )
}
