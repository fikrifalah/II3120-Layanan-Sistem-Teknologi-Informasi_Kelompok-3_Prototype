export const roles = ['client', 'freelancer', 'arbiter'] as const
export type Role = typeof roles[number]
export interface Account { id?: number; email?: string; name: string; role: Role; company?: string }
interface Session { user: Account; token: string; expires: number }

// Login asli bila VITE_AUTH_API=true, walaupun fitur lain masih mock (VITE_USE_MOCK=true).
const mock = import.meta.env.VITE_AUTH_API !== 'true' && import.meta.env.VITE_USE_MOCK === 'true'
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const key = mock ? 'gigly.demo.session' : 'gigly.session'
const demoNames: Record<Role, string> = { client: 'Alex Lee', freelancer: 'Rafi Pratama', arbiter: 'Maya Putri' }
const invalid = 'Invalid email, password, or role.'

function isAccount(value: Account | undefined): value is Account {
  return !!value && typeof value.name === 'string' && roles.includes(value.role)
}

/** akun yang sedang login dari sesi tersimpan; null bila belum login. */
export function currentAccount(): Account | null {
  try {
    const user = JSON.parse(sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? 'null')?.user
    return isAccount(user) ? user : null
  } catch {
    return null
  }
}

/** id akun yang sedang login; null bila belum login atau sesi mock (tanpa id). */
export function currentAccountId(): number | null {
  const id = currentAccount()?.id
  return Number.isInteger(id) ? (id as number) : null
}

/** token sesi yang sedang login ('' bila belum login atau sesi mock). */
export function currentToken(): string {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? 'null')?.token ?? ''
  } catch {
    return ''
  }
}

export function clearSession() {
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

export async function restore(): Promise<Session | null> {
  const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key)
  if (!raw) return null
  try {
    const saved: Session = JSON.parse(raw)
    if (!isAccount(saved.user) || !(saved.expires > Date.now())) return null
    if (mock) return saved
    const response = await fetch(base + '/auth/me', { headers: { Authorization: 'Bearer ' + saved.token } })
    if (!response.ok) return null
    const { data } = await response.json()
    return isAccount(data) ? { ...saved, user: data } : null
  } catch {
    return null
  }
}

export async function login(role: Role, email: string, password: string, remember: boolean): Promise<Session> {
  let session: Session
  if (mock) {
    const name = demoNames[role]
    if (email.trim().toLowerCase() !== name.replaceAll(' ', '').toLowerCase() + '@example.com' || password !== '1234') {
      throw new Error(invalid)
    }
    session = { user: { name, role }, token: '', expires: Date.now() + 3600000 }
  } else {
    const response = await fetch(base + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email: email.trim(), password }),
    })
    if (!response.ok) throw new Error(response.status === 401 ? invalid : 'Login service unavailable. Please try again.')
    const { data } = await response.json()
    if (!isAccount(data?.user) || data.user.role !== role || !data.access_token || !(data.expires_in > 0)) throw new Error(invalid)
    session = { user: data.user, token: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  }
  clearSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(key, JSON.stringify(session))
  return session
}

export function logout(token: string) {
  clearSession()
  if (!mock && token) void fetch(base + '/auth/logout', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
  }).catch(() => {})
}
