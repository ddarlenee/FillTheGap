import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import GapDashboardPage from './pages/GapDashboardPage'
import CareerProgressionPage from './pages/CareerProgressionPage'
import AuthPage from './pages/AuthPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <Routes>
                <Route path="/" element={<UploadPage />} />
                <Route path="/role-selection" element={<RoleSelectionPage />} />
                <Route path="/gap-dashboard" element={<GapDashboardPage />} />
                <Route path="/career-progression" element={<CareerProgressionPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Routes>
            </>
          }
        />
      </Routes>
    </div>
  )
}