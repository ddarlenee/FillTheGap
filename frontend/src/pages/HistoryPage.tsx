import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { fetchHistory, completeHistoryStep } from '../api/auth'
import type { ExtractedSkill } from '../types'

interface NextStep {
  summary?: string    // one-liner: action + platform
  text: string        // full detail
  skill: string
  tier: string        // 'Essential' | 'Important' | 'Nice-to-have'
  completed: boolean
}

interface GapRecord {
  skill: string
  tier: string
}

interface HistoryEntry {
  id: string
  created_at: string
  role: string
  coverage: { essential: string; important: string; nice_to_have?: string; source_entry_id?: string | null }
  gaps: (string | GapRecord)[]
  next_steps?: (string | Partial<NextStep>)[]
  user_skills?: string[]
  transferability_score?: number  // set for career-stage entries; used as fixed readiness base
}

function gapSkills(gaps: HistoryEntry['gaps']): string[] {
  return gaps.map((g) => (typeof g === 'string' ? g : g.skill))
}

function normalizeSteps(steps: HistoryEntry['next_steps'] = []): NextStep[] {
  return steps.map((s) =>
    typeof s === 'string'
      ? { summary: '', text: s, skill: '', tier: 'Important', completed: false }
      : {
          summary: s.summary ?? '',
          text: s.text ?? '',
          skill: s.skill ?? '',
          tier: s.tier ?? 'Important',
          completed: !!s.completed,
        }
  )
}

function shortLine(step: NextStep): string {
  if (step.summary) return step.summary
  const t = step.text
  const comma = t.indexOf(',')
  if (comma > 20 && comma < 80) return t.slice(0, comma)
  return t.length > 72 ? t.slice(0, 70) + '…' : t
}

function parseCoverage(raw: string): [number, number] {
  const parts = (raw ?? '0/0').split('/')
  if (parts.length !== 2) return [0, 0]
  return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0]
}

function adjustCoverage(
  cov: HistoryEntry['coverage'],
  tier: string,
  delta: number,
): HistoryEntry['coverage'] {
  const key = tier === 'Essential' ? 'essential' : tier === 'Important' ? 'important' : 'nice_to_have'
  const raw = (cov as Record<string, string>)[key] ?? '0/0'
  const [have, total] = parseCoverage(raw)
  return { ...cov, [key]: `${Math.max(0, Math.min(have + delta, total))}/${total}` }
}

function computeReadiness(
  entry: HistoryEntry,
  steps: NextStep[],
): { pct: number; remaining: number } {
  // Career-stage entries store transferability_score as a fixed base so that
  // the readiness bar never starts at 100% regardless of LLM matching.
  // Regular resume entries derive the base from actual skill coverage.
  let basePct: number
  if (entry.transferability_score !== undefined) {
    basePct = entry.transferability_score
  } else {
    const [eHave, eTotal] = parseCoverage(entry.coverage.essential)
    const [iHave, iTotal] = parseCoverage(entry.coverage.important)
    const wHave = eHave * 3 + iHave * 2
    const wTotal = eTotal * 3 + iTotal * 2
    basePct = wTotal === 0 ? 0 : Math.round((wHave / wTotal) * 100)
  }

  // Only required (Essential + Important) steps count toward 100%
  const required = steps.filter((s) => s.tier !== 'Nice-to-have')
  const completedRequired = required.filter((s) => s.completed).length
  const totalRequired = required.length

  let pct: number
  if (totalRequired > 0) {
    pct = Math.min(100, Math.round(basePct + (100 - basePct) * (completedRequired / totalRequired)))
  } else {
    pct = basePct
  }

  const remaining = Math.max(0, totalRequired - completedRequired)
  return { pct, remaining }
}

function barColor(pct: number): string {
  if (pct === 100) return 'bg-green-500'
  if (pct >= 75) return 'bg-green-400'
  if (pct >= 50) return 'bg-amber-400'
  if (pct >= 25) return 'bg-orange-400'
  return 'bg-red-400'
}

function encouragement(pct: number, remaining: number): string {
  if (pct === 100) return "All required skills covered — you're ready for this role!"
  if (pct >= 75) return `Almost there! ${remaining} more step${remaining === 1 ? '' : 's'} to go.`
  if (pct >= 50) return `Past the halfway mark. Keep going — ${remaining} step${remaining === 1 ? '' : 's'} left.`
  if (pct >= 25) return `Good start. Every completed step brings you closer.`
  return `Start ticking off next steps to close the gap for this role.`
}

const tierBadge: Record<string, string> = {
  Essential: 'bg-red-50 text-red-700 border border-red-200',
  Important: 'bg-amber-50 text-amber-700 border border-amber-200',
  'Nice-to-have': 'bg-green-50 text-green-700 border border-green-200',
}

interface StepItemProps {
  step: NextStep
  globalIdx: number
  toggling: number | null
  onToggle: (globalIdx: number) => void
}

function StepItem({ step, globalIdx, toggling, onToggle }: StepItemProps) {
  const [expanded, setExpanded] = useState(false)
  const short = shortLine(step)
  const hasMore = step.text && step.text !== short
  const isToggling = toggling === globalIdx

  return (
    <li className="flex items-start gap-2.5">
      <button
        onClick={() => onToggle(globalIdx)}
        disabled={toggling !== null}
        className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
          step.completed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'
        } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {step.completed && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        {step.skill && (
          <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded mr-1 mb-0.5 ${tierBadge[step.tier] ?? 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
            {step.skill}
          </span>
        )}
        {step.skill && step.completed && (
          <span className="inline-block text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded mr-1 mb-0.5">
            +added to skills
          </span>
        )}
        <p className={`text-sm leading-snug inline ${step.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {expanded ? step.text : short}
          {hasMore && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-1 text-xs text-blue-500 hover:underline whitespace-nowrap"
              style={{ textDecoration: 'none' }}
            >
              learn more
            </button>
          )}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="ml-1 text-xs text-gray-400 hover:underline whitespace-nowrap"
              style={{ textDecoration: 'none' }}
            >
              less
            </button>
          )}
        </p>
      </div>
    </li>
  )
}

interface CardProps {
  entry: HistoryEntry
  onUpdate: (updated: HistoryEntry) => void
  onAdvance: (role: string, skills: string[], entryId: string) => void
  hasAdvanced: boolean
}

function HistoryCard({ entry: propEntry, onUpdate, onAdvance, hasAdvanced }: CardProps) {
  const [entry, setEntry] = useState(propEntry)
  const [showAllGaps, setShowAllGaps] = useState(false)
  const [showNextSteps, setShowNextSteps] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  useEffect(() => { setEntry(propEntry) }, [propEntry])

  const gaps = gapSkills(entry.gaps)
  const steps = normalizeSteps(entry.next_steps)
  const userSkills = entry.user_skills ?? []

  const requiredSteps = steps.filter((s) => s.tier !== 'Nice-to-have')
  const optionalSteps = steps.filter((s) => s.tier === 'Nice-to-have')
  const totalStepsDone = steps.filter((s) => s.completed).length
  const requiredDone = requiredSteps.filter((s) => s.completed).length

  const visibleGaps = showAllGaps ? gaps : gaps.slice(0, 5)
  const hasMoreGaps = gaps.length > 5
  const [essHave, essTotal] = parseCoverage(entry.coverage.essential)
  const [impHave, impTotal] = parseCoverage(entry.coverage.important)

  const { pct, remaining } = computeReadiness(entry, steps)
  const isReady = pct === 100

  async function handleToggle(globalIdx: number) {
    if (toggling !== null) return
    const step = steps[globalIdx]
    if (!step) return

    const nowCompleted = !step.completed
    const skill = step.skill
    const stepTier = step.tier

    const optimisticSteps = steps.map((s, i) =>
      i === globalIdx ? { ...s, completed: nowCompleted } : s
    )
    let newUserSkills = [...userSkills]
    let newGaps = [...entry.gaps]
    let newCoverage = { ...entry.coverage }

    if (skill) {
      if (nowCompleted) {
        if (!newUserSkills.includes(skill)) newUserSkills.push(skill)
        let gapTier = stepTier
        newGaps = entry.gaps.filter((g) => {
          if (typeof g === 'string') { if (g === skill) { gapTier = 'Important'; return false } return true }
          if (g.skill === skill) { gapTier = g.tier; return false }
          return true
        })
        newCoverage = adjustCoverage(newCoverage, gapTier, +1)
      } else {
        newUserSkills = newUserSkills.filter((s) => s !== skill)
        newGaps = [...entry.gaps, { skill, tier: stepTier }]
        newCoverage = adjustCoverage(newCoverage, stepTier, -1)
      }
    }

    const optimistic: HistoryEntry = {
      ...entry,
      next_steps: optimisticSteps,
      user_skills: newUserSkills,
      gaps: newGaps,
      coverage: newCoverage,
    }

    const prev = entry
    setEntry(optimistic)
    setToggling(globalIdx)

    try {
      const updated = await completeHistoryStep(entry.id, globalIdx)
      setEntry(updated)
      onUpdate(updated)
    } catch {
      setEntry(prev)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-800">{entry.role}</p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
        </div>
        <div className="text-right text-sm space-y-0.5">
          <p className="text-red-500">Essential: {essHave}/{essTotal}</p>
          <p className="text-amber-500">Important: {impHave}/{impTotal}</p>
        </div>
      </div>

      {/* Role Readiness */}
      <div className={`rounded-lg p-3 ${isReady ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Role Readiness</span>
          <span className={`text-sm font-bold ${isReady ? 'text-green-600' : 'text-gray-800'}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${barColor(pct)}`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
        <p className={`text-xs mt-1.5 ${isReady ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
          {encouragement(pct, remaining)}
        </p>
      </div>

      {/* 100% celebration + advance button */}
      {isReady && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center space-y-2">
          <p className="text-green-800 font-semibold text-base">You're role-ready for {entry.role}!</p>
          <p className="text-green-700 text-sm">You've closed all essential and important skill gaps. Ready to aim higher?</p>
          {!hasAdvanced && (
            <button
              onClick={() => {
                // Exclude skills acquired by ticking off next steps — those are still being
                // learned and should appear as gaps in the next-stage analysis.
                const stepSkills = new Set(
                  normalizeSteps(entry.next_steps)
                    .filter((s) => s.completed && s.skill)
                    .map((s) => s.skill)
                )
                const baseSkills = (entry.user_skills ?? []).filter((s) => !stepSkills.has(s))
                onAdvance(entry.role, baseSkills, entry.id)
              }}
              className="mt-1 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              What's next? See your career path
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          )}
        </div>
      )}

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
            {showNextSteps
              ? 'Hide next steps'
              : `Next steps${totalStepsDone > 0 ? ` (${totalStepsDone}/${steps.length} done)` : ''}`}
          </button>
        )}
        </div>

      {/* Next steps */}
      {showNextSteps && steps.length > 0 && (
        <div className="space-y-4">
          {requiredSteps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Required steps — {requiredDone}/{requiredSteps.length} done
              </p>
              <ol className="space-y-3">
                {requiredSteps.map((step) => {
                  const globalIdx = steps.indexOf(step)
                  return <StepItem key={globalIdx} step={step} globalIdx={globalIdx} toggling={toggling} onToggle={handleToggle} />
                })}
              </ol>
            </div>
          )}

          {optionalSteps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Optional — Nice-to-have skills
              </p>
              <p className="text-xs text-gray-400 mb-2">Not required for this role, but will strengthen your profile.</p>
              <ol className="space-y-3">
                {optionalSteps.map((step) => {
                  const globalIdx = steps.indexOf(step)
                  return <StepItem key={globalIdx} step={step} globalIdx={globalIdx} toggling={toggling} onToggle={handleToggle} />
                })}
              </ol>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, userName, userEmail, logout, setAnalysisResult, resetProgress } = useSessionStore()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Re-fetch on every navigation to this page (location.key changes per visit)
  // so a newly saved career stage entry is always visible immediately.
  useEffect(() => {
    if (!token) { navigate('/auth'); return }
    setLoading(true)
    fetchHistory(token)
      .then(setHistory)
      .catch(() => { logout(); navigate('/auth') })
      .finally(() => setLoading(false))
  }, [token, location.key])

  function handleEntryUpdate(updated: HistoryEntry) {
    setHistory((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  // Entries the user has already advanced from (their next stage exists in history)
  // shouldn't show the "What's next" prompt again.
  const advancedEntryIds = new Set(
    history.map((e) => e.coverage?.source_entry_id).filter((id): id is string => !!id)
  )

  function handleAdvance(role: string, skills: string[], entryId: string) {
    const syntheticSkills: ExtractedSkill[] = skills.map((name) => ({
      name,
      evidence: 'Completed via learning goals',
      confidence: 'High',
    }))
    setAnalysisResult({
      target_roles: [role],
      user_skills: syntheticSkills,
      tiered_role_skills: [],
      coverage_score: { essential: '', important: '', nice_to_have: '' },
      gaps: [],
      next_steps: [],
    })
    resetProgress()
    navigate('/career-progression', { state: { from: 'history', sourceEntryId: entryId } })
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
          <HistoryCard
            key={entry.id}
            entry={entry}
            onUpdate={handleEntryUpdate}
            onAdvance={handleAdvance}
            hasAdvanced={advancedEntryIds.has(entry.id)}
          />
        ))}
      </div>
    </div>
  )
}
