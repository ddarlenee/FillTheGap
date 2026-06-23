import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { postAnalyse } from '../api/analyse'
import SkillCard from '../components/SkillCard'
import TieredSkillList from '../components/TieredSkillList'
import GapSummary from '../components/GapSummary'
import SkillRadarChart from '../components/SkillRadarChart'

export default function GapDashboardPage() {
  const navigate = useNavigate()
  const { analysisResult, resumeText, setAnalysisResult, setProgressResult } = useSessionStore()
  const [showRoles, setShowRoles] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [allRoles, setAllRoles] = useState<string[]>([])

  useEffect(() => {
    if (!analysisResult) navigate('/')
  }, [analysisResult, navigate])

  // Capture the full matched list on first load; keep it across role switches
  useEffect(() => {
    if (analysisResult && analysisResult.target_roles.length > allRoles.length) {
      setAllRoles(analysisResult.target_roles)
    }
  }, [analysisResult])

  if (!analysisResult) return null

  const { target_roles, user_skills, tiered_role_skills, coverage_score, gaps, next_steps } = analysisResult
  const currentRole = target_roles[0]
  const otherRoles = allRoles.filter((r) => r !== currentRole)

  async function switchRole(role: string) {
    if (!resumeText) return
    setSwitching(role)
    setShowRoles(false)
    try {
      const result = await postAnalyse({ resume_text: resumeText, target_role: role })
      setAnalysisResult(result)
      setProgressResult(null as any) // clear stale career ladder
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {switching && (
        <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-600 font-medium mb-1">Re-analysing for</div>
            <div className="text-blue-700 font-bold text-lg">{switching}</div>
            <div className="text-gray-400 text-sm mt-2">This takes ~20 seconds…</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Gap Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">
            Target: <span className="font-medium text-gray-700">{currentRole}</span>
            {allRoles.length > 1 && (
              <span className="relative">
                <button
                  onClick={() => setShowRoles((o) => !o)}
                  className="ml-1 text-blue-500 hover:text-blue-700 font-medium underline underline-offset-2"
                >
                  +{otherRoles.length} other match{otherRoles.length > 1 ? 'es' : ''}
                </button>
                {showRoles && (
                  <div className="absolute left-0 top-6 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-2 w-72">
                    <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">All matched roles</p>
                    {allRoles.map((role) => (
                      <div key={role} className="px-4 py-2 hover:bg-gray-50">
                        {role === currentRole ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Current</span>
                            <span className="text-sm text-gray-500">{role}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => switchRole(role)}
                            className="w-full text-left text-sm text-gray-800 hover:text-blue-600 font-medium"
                          >
                            {role}
                            <span className="ml-2 text-xs text-blue-400">Analyse →</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/career-progression')}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          View Career Path →
        </button>
      </div>

      <div className="mb-8">
        <SkillRadarChart roleSkills={tiered_role_skills} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">
            Your Skills <span className="text-gray-400 font-normal">({user_skills.length})</span>
          </h2>
          {user_skills.map((s) => (
            <SkillCard key={s.name} skill={s} />
          ))}
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Role Requirements</h2>
          <TieredSkillList skills={tiered_role_skills} userSkills={user_skills} />
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Gap Summary</h2>
          <GapSummary score={coverage_score} gaps={gaps} nextSteps={next_steps} />
        </div>
      </div>
    </div>
  )
}
