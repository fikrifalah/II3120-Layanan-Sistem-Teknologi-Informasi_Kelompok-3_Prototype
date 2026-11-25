import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cx } from '../../lib/utils.js'

const VARIANTS = {
  primary:
    'bg-primary text-white [@media(hover:hover)]:hover:bg-primary-hover disabled:bg-line disabled:text-ink-muted',
  secondary:
    'border-[1.5px] border-primary bg-surface text-primary [@media(hover:hover)]:hover:bg-primary-subtle disabled:border-line disabled:text-ink-muted',
  text: 'text-primary [@media(hover:hover)]:hover:bg-primary-subtle disabled:text-ink-muted',
}

/**
 * Gigly button. One primary per section.
 * `as` lets it render a router <Link>. Press feedback is instant (scale on :active),
 * hover is gated to real pointers so touch screens never get stuck hover states.
 */
const Button = forwardRef(function Button(
  { as: Tag = 'button', variant = 'primary', loading = false, disabled, className, children, ...props },
  ref,
) {
  const isButton = Tag === 'button'
  const inactive = disabled || loading
  return (
    <Tag
      ref={ref}
      {...(isButton ? { type: props.type ?? 'button', disabled: inactive } : {})}
      aria-busy={loading || undefined}
      aria-disabled={!isButton && inactive ? true : undefined}
      className={cx(
        'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-input px-5 text-small font-semibold',
        'transition-[transform,background-color,border-color,color] duration-150 ease-out',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        loading && 'opacity-90',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Tag>
  )
})

export default Button
