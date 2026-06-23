import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { fetchHistory, completeHistoryStep } from '../api/auth'

interface NextStep {
  text: string
  skill: string
  completed: boolean
}

interface GapRecord {
  skill: string
  tier: string
}

interface HistoryEntry {
  id: string
  timestamp: string
  role: string
  coverage: { essential: string; important: string; nice_to_have?: string }
  gaps: (string | GapRecord)[]
  next_steps?: (string | NextStep)[]
  user_skills?: string[]
}

function gapSkills(gaps: HistoryEntry['gaps']): string[] {
  return gaps.map((g) => (typeof g === 'string' ? g : g.skill))
}

function normalizeSteps(steps: HistoryEntry['next_steps'] = []): NextStep[] {
  return steps.map((s) =>
    typeof s === 'string' ? { text: s, skill: '', completed: false } : s
  )
}

function parseCoverage(raw: string): [number, number] {
  const parts = raw.split('/')
  if (parts.length !== 2) return [0, 0]
  return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0]
}

interface CardProps {
  entry: HistoryEntry
  onUpdate: (updated: HistoryEntry) => void
}

function HistoryCard({ entry, onUpdate }: CardProps) {
  const [showAllGaps, setShowAllGaps] = useState(false)
  const [showNextSteps, setShowNextSteps] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const gaps = gapSkills(entry.gaps)
  const steps = normalizeSteps(entry.next_steps)
  const userSkills = entry.user_skills ?? []

  const visibleGaps = showAllGaps ? gaps : gaps.slice(0, 5)
  const hasMoreGaps = gaps.length > 5

  const [essHave, essTotal] = parseCoverage(entry.coverage.essential)
  const [impHave, impTotal] = parseCoverage(entry.coverage.important)

  async function handleToggle(idx: number) {
    if (toggling !== null) return
    setToggling(idx)
    try {
      const updated = await completeHistoryStep(entry.id, idx)
      onUpdate(updated)
    } catch {
      // silently ignore; UI stays unchanged
    } finally {
      setToggling(null)
    }
  }

  const completedCount = steps.filter((s) => s.completed).length

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-800">{entry.role}</p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.timestamp).toLocaleString()}</p>
        </div>
        <div className="text-right text-sm space-y-0.5">
          <p className="text-red-500">Essential: {essHave}/{essTotal}</p>
          <p className="text-amber-500">Important: {impHave}/{impTotal}</p>
        </div>
      </div>

      {/* Missing skills */}
      {gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Missing skills</p>
          <div className="flex flex-wrap gap-1">
            {visibleGaps.map((g) => (
              <span key={g} className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded">{g}</span>
            ))}
          </div>
          {hasMoreGaps && (
            <button onClick={() => setShowAllGaps((v) => !v)} className="mt-2 text-xs text-blue-500 hover:underline">
              {showAllGaps ? 'View less' : `View ${gaps.length - 5} more`}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {steps.length > 0 && (
          <button
            onClick={() => setShowNextSteps((v) => !v)}
            className="text-xs border border-blue-200 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-50 transition-colors"
          >
            {showNextSteps ? 'Hide next steps' : `Next steps${completedCount > 0 ? ` (${completedCount}/${steps.length} done)` : ''}`}
          </button>
        )}
        {userSkills.length > 0 && (
          <button
            onClick={() => setShowSkills((v) => !v)}
            className="text-xs border border-gray-200 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors"
          >
            {showSkills ? 'Hide your skills' : `Your skills (${userSkills.length})`}
          </button>
        )}
      </div>

      {/* Next steps with checkboxes */}
      {showNextSteps && steps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Next steps</p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <button
                  onClick={() => handleToggle(i)}
                  disabled={toggling !== null}
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    step.completed
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 hover:border-blue-400'
                  } ${toggling === i ? 'opacity-50' : ''}`}
                >
                  {step.completed && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className={`text-sm leading-snug ${step.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {step.text}
                  {step.skill && step.completed && (
                    <span className="ml-1.5 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded not-italic no-underline" style={{textDecoration:'none'}}>
                      +{step.skill}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* User skills */}
      {showSkills && userSkills.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Your skills</p>
          <div className="flex flex-wrap gap-1">
            {userSkills.map((s) => (
              <span key={s} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const { token, userName, userEmail, logout } = useSessionStore()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/auth'); return }
    fetchHistory(token)
      .then(setHistory)
      .catch(() => { logout(); navigate('/auth') })
      .finally(() => setLoading(false))
  }, [])

  function handleEntryUpdate(updated: HistoryEntry) {
    setHistory((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Progress History</h1>
          <p className="text-gray-400 text-sm">{userName} · {userEmail}</p>
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
          <HistoryCard key={entry.id} entry={entry} onUpdate={handleEntryUpdate} />
        ))}
      </div>
    </div>
  )
}
