/** Join class names, skipping falsy values. */
export const cx = (...parts) => parts.filter(Boolean).join(' ')

/** 0x5FbDB2315678afecb367f032d93F642f64180aa3 -> 0x5FbD…0aa3 */
export function truncateMiddle(value, head = 6, tail = 4) {
  if (!value || value.length <= head + tail + 1) return value ?? ''
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

const LOCALES = { id: 'id-ID', en: 'en-US' }

export const formatNumber = (n, lang, opts) =>
  new Intl.NumberFormat(LOCALES[lang] ?? 'id-ID', opts).format(n)

export const formatScore = (n, lang) =>
  formatNumber(n, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const formatDate = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang] ?? 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

/** Replace {name} placeholders in a translated string. */
export function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in params ? params[key] : `{${key}}`))
}
