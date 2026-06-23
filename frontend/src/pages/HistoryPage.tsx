import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { fetchHistory } from '../api/auth'

interface HistoryEntry {
  id: string
  timestamp: string
  role: string
  coverage: { essential: string; important: string }
  gaps: string[]
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const { token, user, logout } = useAuthStore()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/auth'); return }
    fetchHistory(token)
      .then(setHistory)
      .catch(() => { logout(); navigate('/auth') })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Progress History</h1>
          <p className="text-gray-400 text-sm">{user?.name} · {user?.email}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="text-blue-600 text-sm hover:underline">+ New Analysis</button>
          <button onClick={() => { logout(); navigate('/auth') }} className="text-gray-400 text-sm hover:underline">Sign out</button>
        </div>
      </div>

      {loading && <p className="text-gray-400">Loading...</p>}

      {!loading && history.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No analyses yet</p>
          <p className="text-sm mt-1">Run your first resume analysis to start tracking progress</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Start Analysis</button>
        </div>
      )}

      <div className="space-y-4">
        {history.slice().reverse().map((entry) => (
          <div key={entry.id} className="bg-white border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{entry.role}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-red-500">Essential: {entry.coverage.essential}</p>
                <p className="text-amber-500">Important: {entry.coverage.important}</p>
              </div>
            </div>
            {entry.gaps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {entry.gaps.map((g) => (
                  <span key={g} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{g}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}