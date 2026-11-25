/** Join class names, skipping falsy values. */
export function cn(...parts: Array<string | number | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}
