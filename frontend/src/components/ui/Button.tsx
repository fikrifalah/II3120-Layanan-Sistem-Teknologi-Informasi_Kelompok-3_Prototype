import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] active:duration-100 disabled:pointer-events-none [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(74,63,193,0.24)] hover:bg-brand-hover disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none',
  secondary: 'border border-brand/70 bg-surface text-brand hover:border-brand hover:bg-brand-soft disabled:border-line disabled:text-disabled-text',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-disabled-text',
  danger: 'border border-danger/70 bg-surface text-danger hover:border-danger hover:bg-danger-soft disabled:border-line disabled:text-disabled-text',
  quiet: 'border border-line bg-surface text-ink hover:border-line-control/50 hover:bg-canvas disabled:text-disabled-text',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-small',
  md: 'h-11 px-4 text-small',
  lg: 'h-12 px-5 text-body',
}

interface Common {
  variant?: ButtonVariant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  block?: boolean
  className?: string
  children?: ReactNode
}

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('group/btn', base, variants[variant], sizes[size], block && 'w-full', loading && 'cursor-progress', className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight && <span className="inline-flex transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5">{iconRight}</span>}
    </button>
  )
})

type LinkButtonProps = Common & { to: string; 'aria-label'?: string; onClick?: () => void }

export function LinkButton({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, to, ...rest }: LinkButtonProps) {
  return (
    <Link to={to} className={cn('group/btn', base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
      {iconRight && <span className="inline-flex transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5">{iconRight}</span>}
    </Link>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-sm text-ink-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-soft hover:text-brand active:scale-[0.94]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
