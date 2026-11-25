import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ClientView from './pages/ClientView'
import FreelancerView from './pages/FreelancerView'
import ArbiterView from './pages/ArbiterView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/client" replace />} />
        <Route path="/client/*" element={<ClientView />} />
        <Route path="/freelancer/*" element={<FreelancerView />} />
        <Route path="/arbiter/*" element={<ArbiterView />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
