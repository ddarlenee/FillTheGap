import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <button onClick={() => navigate('/')} className="font-bold text-gray-800 hover:text-blue-600">
        Skills Analyser
      </button>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <span className="text-gray-400">Hi, {user.name.split(' ')[0]}</span>
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