import { Navigate, Route, Routes } from 'react-router-dom'
import ClientShell from '../layouts/ClientShell'
import { ClientStoreProvider } from '../services/store'
import { ToastProvider } from '../components/ui/Feedback'
import Dashboard from './client/Dashboard'
import Projects from './client/Projects'
import CreateProject from './client/CreateProject'
import Matches from './client/Matches'
import CandidateDetail from './client/CandidateDetail'
import Invitations from './client/Invitations'
import ContractBuilder from './client/ContractBuilder'
import FundEscrow from './client/FundEscrow'
import Workspace from './client/Workspace'
import MilestoneReview from './client/MilestoneReview'
import FindTalent from './client/FindTalent'
import Contracts from './client/Contracts'
import WalletPage from './client/WalletPage'
import Disputes from './client/Disputes'
import Placeholder from './client/Placeholder'

/**
 * ClientParticipant views, mounted at /client/*.
 * Routes follow the Web App Master Plan §6–§8 and §12, scoped under /client.
 */
export default function ClientView() {
  return (
    <ClientStoreProvider>
      <ToastProvider>
        <Routes>
          <Route element={<ClientShell />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<CreateProject />} />
            <Route path="projects/:projectId" element={<Workspace />} />
            <Route path="projects/:projectId/matches" element={<Matches />} />
            <Route path="projects/:projectId/candidates/:candidateId" element={<CandidateDetail />} />
            <Route path="projects/:projectId/invitations" element={<Invitations />} />
            <Route path="projects/:projectId/contract" element={<ContractBuilder />} />
            <Route path="projects/:projectId/fund" element={<FundEscrow />} />
            <Route path="projects/:projectId/milestones/:milestoneId/review" element={<MilestoneReview />} />
            <Route path="talent" element={<FindTalent />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="messages" element={<Placeholder kind="messages" />} />
            <Route path="settings" element={<Placeholder kind="settings" />} />
            <Route path="help" element={<Placeholder kind="help" />} />
            <Route path="*" element={<Navigate to="/client" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </ClientStoreProvider>
  )
}
