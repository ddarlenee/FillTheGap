import { Routes, Route } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import GapDashboardPage from './pages/GapDashboardPage'
import CareerProgressionPage from './pages/CareerProgressionPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/role-selection" element={<RoleSelectionPage />} />
        <Route path="/gap-dashboard" element={<GapDashboardPage />} />
        <Route path="/career-progression" element={<CareerProgressionPage />} />
      </Routes>
    </div>
  )
}
