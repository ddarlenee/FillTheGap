import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useSessionStore } from '../store/useSessionStore'
import { getRoles } from '../api/roles'
import { postAnalyse } from '../api/analyse'
import { useAuthStore } from '../store/useAuthStore'

export default function RoleSelectionPage() {
  const navigate = useNavigate()
  const { sessionId, resumeText, mode, selectedRole, setSelectedRole, setAnalysisResult } = useSessionStore()
  const [query, setQuery] = useState('')

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', query],
    queryFn: () => getRoles(query),
    enabled: mode === 'target',
  })

  const { token } = useAuthStore()

  const mutation = useMutation({
    mutationFn: () => postAnalyse({
      session_id: sessionId!,
      resume_text: resumeText!,
      target_role: mode === 'target' ? selectedRole ?? undefined : undefined,
    }, token),
    onSuccess: (data) => {
      setAnalysisResult(data)
      navigate('/gap-dashboard')
    },
  })

  const errorMessage = mutation.error
    ? axios.isAxiosError(mutation.error)
      ? mutation.error.response?.data?.detail ?? mutation.error.message
      : String(mutation.error)
    : null

  useEffect(() => {
    if (!sessionId || !resumeText) navigate('/')
  }, [sessionId, resumeText, navigate])

  if (!sessionId || !resumeText) return null

  return (
    <div className="max-w-2xl mx-auto mt-16 p-8">
      <h2 className="text-2xl font-bold mb-1 text-gray-900">
        {mode === 'target' ? 'Select your target role' : 'Auto-matching your best roles'}
      </h2>
      <p className="text-gray-500 mb-6">
        {mode === 'target'
          ? 'Choose the role you want to work towards.'
          : 'AI will identify the top 3 roles that match your resume.'}
      </p>

      {mode === 'target' && (
        <>
          <input
            className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Search roles (e.g. Data Analyst, Software Engineer)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="border rounded-lg divide-y max-h-72 overflow-y-auto mb-6">
            {roles.length === 0 && (
              <li className="px-4 py-3 text-gray-400 text-sm">No roles found</li>
            )}
            {roles.map((role) => (
              <li
                key={role}
                onClick={() => { setSelectedRole(role); setQuery(role) }}
                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 text-sm ${selectedRole === role ? 'bg-blue-100 font-semibold text-blue-800' : 'text-gray-700'}`}
              >
                {role}
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (mode === 'target' && !selectedRole)}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700"
      >
        {mutation.isPending ? 'Analysing — this takes ~20 seconds...' : 'Analyse Skills Gap →'}
      </button>

      {errorMessage && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">Analysis failed</p>
          <p className="text-red-500 text-xs mt-1 font-mono break-all">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
