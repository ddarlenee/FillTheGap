import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from './store/useSessionStore'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UploadPage from './pages/UploadPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import GapDashboardPage from './pages/GapDashboardPage'
import CareerProgressionPage from './pages/CareerProgressionPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSessionStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Navbar() {
  const { userEmail, logout } = useSessionStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = userEmail ? userEmail[0].toUpperCase() : '?'

  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100">
      <span className="text-sm font-semibold text-gray-800">Skills Analyser</span>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 border border-gray-200 rounded-full pl-3 pr-2 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm text-gray-600 max-w-[160px] truncate">{userEmail}</span>
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400">Signed in as</p>
              <p className="text-sm font-medium text-gray-800 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<AuthenticatedLayout><UploadPage /></AuthenticatedLayout>} />
        <Route path="/role-selection" element={<AuthenticatedLayout><RoleSelectionPage /></AuthenticatedLayout>} />
        <Route path="/gap-dashboard" element={<AuthenticatedLayout><GapDashboardPage /></AuthenticatedLayout>} />
        <Route path="/career-progression" element={<AuthenticatedLayout><CareerProgressionPage /></AuthenticatedLayout>} />
      </Routes>
    </div>
  )
}
