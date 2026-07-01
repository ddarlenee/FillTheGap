import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/useSessionStore'
import { postProgress } from '../api/progress'
import { saveCareerStage } from '../api/auth'
import CareerLadder from '../components/CareerLadder'

export default function CareerProgressionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { analysisResult, progressResult, setProgressResult, resetProgress } = useSessionStore()
  const [startingRole, setStartingRole] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [startErrorTone, setStartErrorTone] = useState<'encourage' | 'error'>('error')

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
  const sourceEntryId = (location.state as any)?.sourceEntryId as string | undefined
  const backPath = from === 'history' || from === 'navbar' ? '/history' : '/gap-dashboard'

  async function handleStartNow(role: string) {
    if (startingRole) return
    if (!progressResult?.current_role_ready) return
    setStartingRole(role)
    setStartError(null)
    setStartErrorTone('error')

    const rung =
      progressResult?.immediate_next.role === role
        ? progressResult.immediate_next
        : progressResult?.full_ladder.find((r) => r.role === role)

    if (!rung) { setStartingRole(null); return }

    try {
      // Persist the career stage directly from ladder data — no LLM gap analysis needed.
      // transferability_score becomes the fixed readiness base; skill_delta becomes the
      // required gaps; career next_steps become the history checklist.
      await saveCareerStage(rung, analysisResult!.user_skills.map((s) => s.name), sourceEntryId)
      resetProgress()
      navigate('/history')
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Already started this stage (e.g. revisited via the Career Path nav link) —
        // it already lives in History, so just take them there instead of erroring.
        resetProgress()
        navigate('/history')
        return
      }
      if (err?.response?.status === 403) {
        const detail: string = err.response.data?.detail ?? ''
        if (detail.toLowerCase().includes('gap')) {
          // Current role isn't fully complete yet — encourage rather than scold.
          setStartErrorTone('encourage')
          setStartError(
            "You're not quite ready for this one yet — a few essential and important skills in your current role are still open. Head back to History and check them off, then come straight back here. You're closer than you think! 💪"
          )
        } else {
          // Stale/mismatched cached career path — ask them to refresh, not a hard error.
          setStartErrorTone('encourage')
          setStartError("Your career path needs a quick refresh — head back to History and reopen your Career Path to continue.")
        }
        setStartingRole(null)
        return
      }
      setStartErrorTone('error')
      setStartError('Something went wrong starting this stage. Please try again.')
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

      {startError && startErrorTone === 'encourage' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">{startError}</p>
          <button
            onClick={() => navigate('/history')}
            className="mt-2 text-sm font-medium text-amber-700 hover:underline"
          >
            ← Back to History
          </button>
        </div>
      )}

      {startError && startErrorTone === 'error' && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {startError}
        </p>
      )}

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
            readyToAdvance={progressResult.current_role_ready}
          />
        </>
      )}
    </div>
  )
}
