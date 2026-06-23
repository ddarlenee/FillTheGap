import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/useSessionStore'
import { postProgress } from '../api/progress'
import { postAnalyse } from '../api/analyse'
import CareerLadder from '../components/CareerLadder'

export default function CareerProgressionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { analysisResult, progressResult, setProgressResult, setAnalysisResult, resetProgress } = useSessionStore()
  const [startingRole, setStartingRole] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => postProgress({
      current_role: analysisResult!.target_roles[0],
      user_skill_names: analysisResult!.user_skills.map((s) => s.name),
    }),
    onSuccess: setProgressResult,
  })

  useEffect(() => {
    if (!analysisResult) { navigate('/'); return }
    if (!progressResult) mutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult, progressResult, navigate])

  if (!analysisResult) return null

  const from = (location.state as any)?.from ?? 'gap-dashboard'
  const backPath = from === 'history' ? '/history' : '/gap-dashboard'

  async function handleStartNow(role: string) {
    if (startingRole) return
    setStartingRole(role)
    try {
      // Find the career rung so we know which skills are confirmed gaps
      const rung =
        progressResult?.immediate_next.role === role
          ? progressResult.immediate_next
          : progressResult?.full_ladder.find((r) => r.role === role)

      // skill_delta = skills the career analysis says the user still lacks for this role.
      // Excluding them from user_skill_names guarantees meaningful gap coverage
      // (prevents instant 100% when skill sets heavily overlap between adjacent roles).
      const deltaSet = new Set((rung?.skill_delta ?? []).map((s) => s.toLowerCase()))

      const skillsToPass = analysisResult!.user_skills
        .map((s) => s.name)
        .filter((name) => !deltaSet.has(name.toLowerCase()))

      // Preserve whatever evidence is available (real resume quotes or prior synthetic text)
      // so TieredSkillList can show the blockquote on the next stage's gap dashboard.
      const evidenceCache = new Map(
        analysisResult!.user_skills.map((s) => [s.name.toLowerCase(), s.evidence])
      )

      const result = await postAnalyse({ user_skill_names: skillsToPass, target_role: role })

      // Merge evidence back into the new result — the backend creates generic evidence
      // for skill-name inputs, so we restore whatever the user actually had.
      const merged = {
        ...result,
        user_skills: result.user_skills.map((s) => ({
          ...s,
          evidence: evidenceCache.get(s.name.toLowerCase()) ?? s.evidence,
        })),
      }

      setAnalysisResult(merged)
      resetProgress()
      navigate('/gap-dashboard', { state: { from: 'career' } })
    } catch {
      setStartingRole(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(backPath)}
          className="text-blue-600 text-sm hover:underline"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Your Career Path</h1>
      </div>

      {startingRole && (
        <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-gray-600 font-medium mb-1">Analysing skills gap for</div>
            <div className="text-blue-700 font-bold text-lg">{startingRole}</div>
            <div className="text-gray-400 text-sm mt-2">This takes ~20 seconds…</div>
          </div>
        </div>
      )}

      {mutation.isPending && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-lg font-medium">Mapping your career progression...</p>
          <p className="text-sm mt-2">This takes about 10–15 seconds</p>
        </div>
      )}

      {mutation.isError && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Failed to load career path. Please try again.</p>
          <button
            onClick={() => mutation.mutate()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}

      {progressResult && (
        <>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            This path leads toward{' '}
            <span className="font-semibold text-purple-600">{progressResult.long_term_destination}</span>.
            Your current effort is part of a larger, coherent journey.
          </p>
          <CareerLadder
            currentRole={progressResult.current_role}
            immediateNext={progressResult.immediate_next}
            fullLadder={progressResult.full_ladder}
            longTermDestination={progressResult.long_term_destination}
            onStartNow={handleStartNow}
            startingRole={startingRole}
          />
        </>
      )}
    </div>
  )
}
