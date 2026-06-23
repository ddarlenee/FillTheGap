import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { login, register } from '../api/auth'

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
      setError(e?.response?.data?.detail ?? 'Something went wrong')
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
