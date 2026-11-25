import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { restore, logout, clearSession } from './services/auth'
import Login from './pages/Login'
import ClientView from './pages/ClientView'
import FreelancerView from './pages/FreelancerView'
import ArbiterView from './pages/ArbiterView'

export default function App() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof restore>> | undefined>()
  useEffect(() => {
    let active = true
    restore().then(saved => { if (active) setSession(saved) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(() => { clearSession(); setSession(null) }, session.expires - Date.now())
    return () => window.clearTimeout(timer)
  }, [session])
  if (session === undefined) return <p role="status" className="p-8">Loading workspace…</p>
  const role = session?.user.role
  const home = role ? '/' + role + '/dashboard' : '/login'
  const redirect = <Navigate to={home} replace />
  function signOut() { logout(session?.token ?? ''); setSession(null) }
  return <BrowserRouter><Routes>
    <Route path="/login" element={session ? redirect : <Login onLogin={setSession} />} />
    <Route path="/client/*" element={role === 'client' ? <ClientView onLogout={signOut} /> : redirect} />
    {['/freelancer/:section/:invitationId?', '/projects/:projectId/workspace', '/projects/:projectId/milestones/:milestoneId', '/projects/:projectId/milestones/:milestoneId/submit'].map(path =>
      <Route key={path} path={path} element={session && role === 'freelancer' ? <FreelancerView account={String(session.user.id ?? session.user.email ?? session.user.name)} token={session.token} name={session.user.name} onLogout={signOut} /> : redirect} />)}
    <Route path="/arbiter/*" element={role === 'arbiter' ? <><ArbiterView /><button className="link mx-8" onClick={signOut}>Log out</button></> : redirect} />
    <Route path="*" element={redirect} />
  </Routes></BrowserRouter>
}
