import { Navigate, Route, Routes } from 'react-router-dom'
import ClientShell from '../components/layout/ClientShell.jsx'
import ComingSoon from '../client/screens/ComingSoon.jsx'
import PostJob from '../client/screens/PostJob.jsx'
import ProjectDashboard from '../client/screens/ProjectDashboard.jsx'
import Recommendations from '../client/screens/Recommendations.jsx'
import { paths } from '../client/routes.js'

/**
 * ClientParticipant views, mounted at /client/*.
 * Built: post job (1), AI recommendations (2), project dashboard (5).
 * Designed but not built yet: contract & milestones (3), escrow lock (4), milestone review (6),
 * freelancer stops (7, partly via the dashboard dialog), disputes & closing (8).
 */
export default function ClientView() {
  return (
    <Routes>
      <Route element={<ClientShell />}>
        <Route index element={<ProjectDashboard />} />

        <Route path="jobs" element={<Navigate to={paths.recommendations()} replace />} />
        <Route path="jobs/new" element={<PostJob />} />
        <Route path="jobs/:jobId/recommendations" element={<Recommendations />} />
        <Route path="jobs/:jobId/contract" element={<ComingSoon nameKey="rec.nextScreen" />} />

        <Route path="contracts" element={<Navigate to={paths.contract()} replace />} />
        <Route path="contracts/:projectId" element={<ProjectDashboard />} />
        <Route path="contracts/:projectId/milestones/:milestoneId" element={<ComingSoon nameKey="dash.review" />} />

        <Route path="talent" element={<ComingSoon nameKey="nav.findTalent" />} />
        <Route path="messages" element={<ComingSoon nameKey="nav.messages" />} />
        <Route path="payments" element={<ComingSoon nameKey="nav.payments" />} />
        <Route path="company" element={<ComingSoon nameKey="nav.company" />} />
        <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
      </Route>
    </Routes>
  )
}
