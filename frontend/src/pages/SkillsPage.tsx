import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { fetchHistory } from '../api/auth'

interface HistoryEntry {
  id: string
  timestamp: string
  role: string
  user_skills?: string[]
}

export default function SkillsPage() {
  const navigate = useNavigate()
  const { token, logout, analysisResult } = useSessionStore()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/auth'); return }
    fetchHistory(token)
      .then(setHistory)
      .catch(() => { logout(); navigate('/auth') })
      .finally(() => setLoading(false))
  }, [])

  // Aggregate skills across all entries (deduplicated, most recent wins)
  const allSkills = new Map<string, { role: string; date: string }>()
  ;[...history].reverse().forEach((entry) => {
    ;(entry.user_skills ?? []).forEach((skill) => {
      if (!allSkills.has(skill)) {
        allSkills.set(skill, { role: entry.role, date: entry.timestamp })
      }
    })
  })

  // Also fold in current session skills not yet saved
  const sessionSkills = analysisResult?.user_skills ?? []
  sessionSkills.forEach((s) => {
    if (!allSkills.has(s.name)) {
      allSkills.set(s.name, { role: 'Current session', date: new Date().toISOString() })
    }
  })

  // Group skills by role (most recent history entry per role)
  const byRole = new Map<string, string[]>()
  history.slice().reverse().forEach((entry) => {
    if (!byRole.has(entry.role)) {
      byRole.set(entry.role, entry.user_skills ?? [])
    }
  })

  const latestEntry = history.length > 0 ? history[history.length - 1] : null
  const latestSkills = latestEntry?.user_skills ?? sessionSkills.map((s) => s.name)

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Skills</h1>
        <p className="text-gray-400 text-sm mt-1">Skills you've demonstrated or acquired through learning goals</p>
      </div>

      {loading && <p className="text-gray-400">Loading...</p>}

      {!loading && latestSkills.length === 0 && allSkills.size === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No skills recorded yet</p>
          <p className="text-sm mt-1">Complete an analysis or tick off learning goals to build your skill profile</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Start Analysis</button>
        </div>
      )}

      {!loading && latestSkills.length > 0 && (
        <div className="space-y-6">
          {/* Current skill set */}
          <div className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">
                Current skill set
                <span className="ml-2 text-sm font-normal text-gray-400">({latestSkills.length} skills)</span>
              </h2>
              {latestEntry && (
                <span className="text-xs text-gray-400">
                  Last updated {new Date(latestEntry.timestamp).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {latestSkills.map((s) => (
                <span key={s} className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-100">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Skills by role (history) */}
          {history.length > 1 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-widest">Skills per analysis</h2>
              {history.slice().reverse().map((entry) => {
                const skills = entry.user_skills ?? []
                if (skills.length === 0) return null
                return (
                  <div key={entry.id} className="bg-white border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-800 text-sm">{entry.role}</p>
                      <p className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {skills.map((s) => (
                        <span key={s} className="bg-gray-50 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
