import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { fetchHistory } from '../api/auth'

interface HistoryEntry {
  id: string
  created_at: string
  role: string
  user_skills?: string[]
  next_steps?: { skill?: string; completed?: boolean }[]
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

  // Collect every skill the user has — from resume AND from ticked-off next steps.
  // Each history entry's user_skills already reflects step completions (the backend
  // appends to user_skills when a step is checked off), so a simple union is enough.
  const skillSet = new Set<string>()
  history.forEach((entry) => {
    (entry.user_skills ?? []).forEach((s) => skillSet.add(s))
  })
  // Fold in the current in-memory session if it hasn't been persisted yet
  ;(analysisResult?.user_skills ?? []).forEach((s) => skillSet.add(s.name))

  const currentSkills = Array.from(skillSet).sort((a, b) => a.localeCompare(b))

  const latestEntry = history.length > 0 ? history[history.length - 1] : null

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Skills</h1>
        <p className="text-gray-400 text-sm mt-1">
          Skills demonstrated in your resume and acquired by completing learning goals
        </p>
      </div>

      {loading && <p className="text-gray-400">Loading…</p>}

      {!loading && currentSkills.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No skills recorded yet</p>
          <p className="text-sm mt-1">
            Run a resume analysis or tick off learning goals to build your skill profile
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm"
          >
            Start Analysis
          </button>
        </div>
      )}

      {!loading && currentSkills.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">
              Current skills
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({currentSkills.length})
              </span>
            </h2>
            {latestEntry && (
              <span className="text-xs text-gray-400">
                Last updated {new Date(latestEntry.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentSkills.map((skill) => (
              <span
                key={skill}
                className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-100"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
