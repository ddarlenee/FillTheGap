import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { login, register } from '../api/auth'

function getAuthErrorMessage(e: any, isLogin: boolean): string {
  if (!e?.response) {
    // Axios throws without a `response` when the request never got one back
    // (server down, wrong port, CORS block, dropped connection).
    return "Can't reach the server right now. Check your connection and try again."
  }

  const { status, data } = e.response
  const detail = data?.detail

  if (typeof detail === 'string' && detail) return detail

  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI/Pydantic 422 validation errors come back as a list of
    // {loc, msg} objects rather than a plain string.
    const field = Array.isArray(detail[0]?.loc) ? detail[0].loc[detail[0].loc.length - 1] : undefined
    if (field === 'email') return 'Please enter a valid email address.'
    if (field === 'password') return 'Please check your password and try again.'
    return detail[0]?.msg || 'Please check your details and try again.'
  }

  if (status >= 500) {
    return 'The server ran into a problem on our end. Please try again in a moment.'
  }

  return isLogin
    ? 'Could not sign you in. Please check your email and password.'
    : 'Could not create your account. Please check your details and try again.'
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { setAuth } = useSessionStore()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = isLogin
        ? await login(email, password)
        : await register(email, password, name)
      setAuth(res.access_token, res.user.email, res.user.name)
      navigate('/')
    } catch (e: any) {
      setError(getAuthErrorMessage(e, isLogin))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border rounded-2xl shadow-sm p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">FillTheGap</h1>
        <p className="text-gray-400 text-sm mb-8">{isLogin ? 'Sign in to track your progress' : 'Create an account'}</p>

        {!isLogin && (
          <input
            className="w-full border rounded-lg p-3 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full border rounded-lg p-3 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded-lg p-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
        </button>

        <p className="text-center text-sm text-gray-400 mt-4">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button className="text-blue-600 hover:underline" onClick={() => { setIsLogin(!isLogin); setError('') }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="text-center text-xs text-gray-300 mt-3">
          <button className="hover:text-gray-500 underline" onClick={() => navigate('/')}>
            Continue without account
          </button>
        </p>
      </div>
    </div>
  )
}
