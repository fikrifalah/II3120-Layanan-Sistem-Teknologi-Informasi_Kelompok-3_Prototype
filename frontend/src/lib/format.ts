const idr = new Intl.NumberFormat('id-ID')
const num = new Intl.NumberFormat('en-US')

/** Rupiah, as the boards write it: Rp15.000.000 */
export const formatIdr = (n: number) => `Rp${idr.format(Math.round(n))}`

/** Compact Rupiah for tight spots: Rp15 jt */
export const formatIdrShort = (n: number) =>
  n >= 1_000_000 ? `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : formatIdr(n)

/** SIM-IDR token amount: 15,000 SIM-IDR */
export const formatSim = (n: number, withUnit = true) => `${num.format(Math.round(n))}${withUnit ? ' SIM-IDR' : ''}`

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)} min ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)} h ago`
  const d = h / 24
  return d < 7 ? `${Math.floor(d)} d ago` : formatDate(iso)
}

export function greeting() {
  const h = new Date().getHours()
  return h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : 'Good evening'
}

export const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`

export const DAY_MS = 86_400_000

export const isoDaysFromNow = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString()

export const dateInput = (iso: string) => iso.slice(0, 10)

/** Pseudo-random hex string for demo hashes. */
export function fakeHash(bytes = 32): string {
  let out = '0x'
  for (let i = 0; i < bytes; i++) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  return out
}

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
