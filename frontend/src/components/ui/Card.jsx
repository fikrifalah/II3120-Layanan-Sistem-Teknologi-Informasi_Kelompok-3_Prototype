import { cx } from '../../lib/utils.js'

/** Borders, not shadows. Shadows are reserved for floating layers. */
export default function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cx('rounded-card border border-line bg-surface p-6', className)} {...props}>
      {children}
    </Tag>
  )
}
