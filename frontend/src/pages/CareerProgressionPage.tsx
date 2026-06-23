import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/useSessionStore'
import { postProgress } from '../api/progress'
import CareerLadder from '../components/CareerLadder'

export default function CareerProgressionPage() {
  const navigate = useNavigate()
  const { analysisResult, progressResult, setProgressResult } = useSessionStore()

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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/gap-dashboard')}
          className="text-blue-600 text-sm hover:underline"
        >
          ← Back to Gap Analysis
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Your Career Path</h1>
      </div>

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
          />
        </>
      )}
    </div>
  )
}
