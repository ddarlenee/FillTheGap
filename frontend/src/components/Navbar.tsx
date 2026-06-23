import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'

export default function Navbar() {
  const navigate = useNavigate()
  const { userEmail, userName, logout } = useSessionStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const firstName = userName ? userName.split(' ')[0] : userEmail?.split('@')[0] ?? ''

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b bg-white px-6 py-3 flex items-center justify-between">
      <button onClick={() => navigate('/')} className="font-bold text-gray-800 hover:text-blue-600">
        FillTheGap
      </button>

      <div className="flex items-center gap-4 text-sm">
        {userEmail ? (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-xs">
                {firstName[0]?.toUpperCase()}
              </span>
              <span>{firstName}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 top-9 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={() => { setOpen(false); navigate('/skills') }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.349A3.75 3.75 0 0113.5 21h-3a3.75 3.75 0 01-2.647-1.098l-.346-.349z" />
                  </svg>
                  My Skills
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/history') }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { logout(); navigate('/auth') }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => navigate('/auth')} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
            Sign in
          </button>
        )}
      </div>
    </nav>
  )
}
