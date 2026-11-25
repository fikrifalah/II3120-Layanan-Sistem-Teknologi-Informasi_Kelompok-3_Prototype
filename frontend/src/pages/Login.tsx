import { useState, type FormEvent } from 'react'
import { BriefcaseBusiness, Laptop, ShieldCheck, Mail, LockKeyhole, Eye, EyeOff } from 'lucide-react'
import { roles, login, type Role } from '../services/auth'
import { usePageTitle } from '../lib/usePageTitle'
import './login.css'

const labels = { client: 'Client', freelancer: 'Freelancer', arbiter: 'Arbitrase' }
const icons = { client: BriefcaseBusiness, freelancer: Laptop, arbiter: ShieldCheck }

export default function Login({ onLogin }: { onLogin: (session: Awaited<ReturnType<typeof login>>) => void }) {
  usePageTitle('Log in')
  const [role, setRole] = useState<Role>('client')
  const [visible, show] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      onLogin(await login(role, String(fields.get('email')), String(fields.get('password')), fields.has('remember')))
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Login service unavailable. Please try again.' : cause instanceof Error ? cause.message : 'Unable to log in.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="login-page"><div className="login-frame"><div className="login-card">
    <section className="login-brand">
      <img className="login-logo" src="/brand/gigly-logo.png" alt="Gigly" />
      <h1>Log in to your<br />Gigly account</h1>
      <p>Manage projects, collaborate with talent, and track milestones in one place.</p>
      <img className="login-art" src="/brand/login-workspace.png" alt="" />
    </section>
    <form className="login-form" onSubmit={submit} onChange={() => setError('')}>
      <fieldset className="role-options"><legend className="sr-only">Account role</legend>
        {roles.map(value => { const Icon = icons[value]; return <label key={value}>
          <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
          <span><Icon />{labels[value]}</span>
        </label> })}
      </fieldset>
      <label className="login-field">Email<span><Mail /><input required name="email" type="email" autoComplete="username" maxLength={254} /></span></label>
      <div className="login-field"><label htmlFor="password">Password</label><span><LockKeyhole />
        <input id="password" required name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" maxLength={128} />
        <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => show(!visible)}>{visible ? <EyeOff /> : <Eye />}</button>
      </span></div>
      <label className="remember"><input name="remember" type="checkbox" defaultChecked /> Remember me</label>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button className="primary-action" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
    </form>
  </div></div></main>
}
