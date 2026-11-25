import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/index.jsx'
import ClientView from './pages/ClientView.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/client" replace />} />
          <Route path="/client/*" element={<ClientView />} />
          {/* Add the other participant views here, e.g. /freelancer/* and /arbiter/*. */}
          <Route path="*" element={<Navigate to="/client" replace />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  )
}
