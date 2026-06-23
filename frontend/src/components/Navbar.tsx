import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'

export default function Navbar() {
  const navigate = useNavigate()
  const { userEmail, userName, logout } = useSessionStore()

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b bg-white px-6 py-3 flex items-center justify-between">
      <button onClick={() => navigate('/')} className="font-bold text-gray-800 hover:text-blue-600">
        FillTheGap
      </button>
      <div className="flex items-center gap-4 text-sm">
        {userEmail ? (
          <>
            <span className="text-gray-400">Hi, {userName ? userName.split(' ')[0] : userEmail}</span>
            <button onClick={() => navigate('/history')} className="text-blue-600 hover:underline">History</button>
            <button onClick={() => { logout(); navigate('/auth') }} className="text-gray-400 hover:underline">Sign out</button>
          </>
        ) : (
          <button onClick={() => navigate('/auth')} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
            Sign in
          </button>
        )}
      </div>
    </nav>
  )
}
