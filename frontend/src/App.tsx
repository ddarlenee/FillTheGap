import { Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from './store/useSessionStore'
import Navbar from './components/Navbar'
import AuthPage from './pages/AuthPage'
import UploadPage from './pages/UploadPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import GapDashboardPage from './pages/GapDashboardPage'
import CareerProgressionPage from './pages/CareerProgressionPage'
import HistoryPage from './pages/HistoryPage'
import SkillsPage from './pages/SkillsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSessionStore((s) => s.token)
  if (!token) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Navbar />
      <div className="pt-12">{children}</div>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<AuthenticatedLayout><UploadPage /></AuthenticatedLayout>} />
        <Route path="/role-selection" element={<AuthenticatedLayout><RoleSelectionPage /></AuthenticatedLayout>} />
        <Route path="/gap-dashboard" element={<AuthenticatedLayout><GapDashboardPage /></AuthenticatedLayout>} />
        <Route path="/career-progression" element={<AuthenticatedLayout><CareerProgressionPage /></AuthenticatedLayout>} />
        <Route path="/history" element={<AuthenticatedLayout><HistoryPage /></AuthenticatedLayout>} />
        <Route path="/skills" element={<AuthenticatedLayout><SkillsPage /></AuthenticatedLayout>} />
      </Routes>
    </div>
  )
}
